import 'server-only'

import { createAzure } from '@ai-sdk/azure'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

type AzureCachedModel = {
  mode: 'azure'
  model: LanguageModel
}

type OpenAiWebSearchCachedModel = {
  mode: 'openai-web-search'
  model: LanguageModel
  openaiModel: string
  openaiProvider: ReturnType<typeof createOpenAI>
}

export type CachedModel = AzureCachedModel | OpenAiWebSearchCachedModel

let cachedModel: CachedModel | undefined

export function getModel(): CachedModel {
  if (cachedModel) {
    return cachedModel
  }

  const azureResourceName = process.env.AZURE_OPENAI_RESOURCE_NAME
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT

  if (azureResourceName && azureApiKey && azureDeployment) {
    const azure = createAzure({
      resourceName: azureResourceName,
      apiKey: azureApiKey
    })
    cachedModel = { mode: 'azure', model: azure(azureDeployment) }
    return cachedModel
  }

  const openaiApiKey = process.env.OPENAI_API_KEY
  let openaiBaseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1'
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  // Ensure baseURL ends with /v1 for OpenAI-compatible APIs.
  if (!openaiBaseUrl.endsWith('/v1')) {
    openaiBaseUrl = openaiBaseUrl.replace(/\/$/, '') + '/v1'
  }
  if (!openaiApiKey) {
    throw new Error(
      'No AI provider configured. Please set either Azure OpenAI or OpenAI credentials in environment variables.'
    )
  }

  const openai = createOpenAI({
    apiKey: openaiApiKey,
    baseURL: openaiBaseUrl
  })

  cachedModel = {
    mode: 'openai-web-search',
    model: openai.chat(openaiModel),
    openaiModel,
    openaiProvider: openai
  }
  return cachedModel
}
