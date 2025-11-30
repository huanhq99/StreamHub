/**
 * FlixPilot 授权验证服务
 * 与授权服务器通信，验证部署实例的授权状态
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || './data'
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')

// 内置授权服务器地址（用户无需配置）
const BUILT_IN_LICENSE_SERVER = 'https://license.flixpilot.ovh'

// 获取授权服务器地址（优先环境变量覆盖，否则使用内置地址）
function getLicenseServer(): string {
  // 允许通过环境变量覆盖（用于测试或私有部署）
  if (process.env.LICENSE_SERVER) {
    return process.env.LICENSE_SERVER
  }
  // 允许通过 config.json 覆盖
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      if (config.licenseServer) {
        return config.licenseServer
      }
    }
  } catch {}
  // 默认使用内置地址
  return BUILT_IN_LICENSE_SERVER
}

// 授权缓存（避免频繁请求）
let licenseCache: LicenseInfo | null = null
let lastVerifyTime = 0
const VERIFY_INTERVAL = 1000 * 60 * 60 // 1小时验证一次

export interface LicenseInfo {
  valid: boolean
  message: string
  type?: 'standard' | 'pro' | 'enterprise' | 'lifetime'
  maxUsers?: number
  expiresAt?: string | null
  customerName?: string
}

export interface LicenseConfig {
  domain: string      // 用户填写的授权域名
  licenseKey: string  // 授权码
}

// 获取配置中的授权信息
function getLicenseConfig(): LicenseConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null
    }
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    if (config.license?.domain && config.license?.licenseKey) {
      return {
        domain: config.license.domain,
        licenseKey: config.license.licenseKey
      }
    }
    return null
  } catch {
    return null
  }
}

// 验证授权
export async function verifyLicense(forceRefresh = false): Promise<LicenseInfo> {
  // 检查缓存
  const now = Date.now()
  if (!forceRefresh && licenseCache && (now - lastVerifyTime) < VERIFY_INTERVAL) {
    return licenseCache
  }

  const licenseConfig = getLicenseConfig()

  // 未配置授权
  if (!licenseConfig) {
    const result: LicenseInfo = {
      valid: false,
      message: '未配置授权信息，请在设置中填写授权域名和授权码'
    }
    licenseCache = result
    lastVerifyTime = now
    return result
  }

  const licenseServer = getLicenseServer()

  try {
    const response = await fetch(`${licenseServer}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        licenseKey: licenseConfig.licenseKey,
        domain: licenseConfig.domain
      }),
      signal: AbortSignal.timeout(10000) // 10秒超时
    })

    if (!response.ok) {
      throw new Error('授权服务器响应异常')
    }

    const data = await response.json()
    
    const result: LicenseInfo = {
      valid: data.valid,
      message: data.message,
      type: data.license?.type,
      maxUsers: data.license?.maxUsers,
      expiresAt: data.license?.expiresAt,
      customerName: data.license?.customerName
    }

    licenseCache = result
    lastVerifyTime = now
    return result
  } catch (error: any) {
    // 网络错误时，如果有缓存则使用缓存
    if (licenseCache) {
      return licenseCache
    }
    
    const result: LicenseInfo = {
      valid: false,
      message: `授权验证失败: ${error.message}`
    }
    licenseCache = result
    lastVerifyTime = now
    return result
  }
}

// 激活授权
export async function activateLicense(domain: string, licenseKey: string): Promise<{ success: boolean; message: string; license?: LicenseInfo }> {
  const licenseServer = getLicenseServer()
  if (!licenseServer) {
    return {
      success: false,
      message: '未配置授权服务器地址，请在 config.json 或环境变量中配置 LICENSE_SERVER'
    }
  }

  try {
    const response = await fetch(`${licenseServer}/api/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        licenseKey,
        domain
      }),
      signal: AbortSignal.timeout(10000)
    })

    const data = await response.json()

    if (data.success) {
      // 清除缓存，强制重新验证
      licenseCache = null
      lastVerifyTime = 0
    }

    return {
      success: data.success,
      message: data.message,
      license: data.success ? {
        valid: true,
        message: '授权有效',
        type: data.license?.type,
        maxUsers: data.license?.maxUsers,
        expiresAt: data.license?.expiresAt
      } : undefined
    }
  } catch (error: any) {
    return {
      success: false,
      message: `激活失败: ${error.message}`
    }
  }
}

// 检查功能是否可用（根据授权类型）
export async function checkFeatureAccess(feature: string): Promise<{ allowed: boolean; reason?: string }> {
  const license = await verifyLicense()

  if (!license.valid) {
    return { allowed: false, reason: license.message }
  }

  // 终身版和企业版可以使用所有功能
  if (license.type === 'lifetime' || license.type === 'enterprise') {
    return { allowed: true }
  }

  // Pro 版功能
  const proFeatures = ['moviepilot', 'telegram', 'advanced-stats', 'multi-emby']
  if (proFeatures.includes(feature) && license.type !== 'pro') {
    return { allowed: false, reason: '此功能需要 Pro 版授权' }
  }

  return { allowed: true }
}

// 获取当前授权状态（用于前端显示）
export async function getLicenseStatus(): Promise<{
  configured: boolean
  valid: boolean
  info: LicenseInfo | null
  config: { domain: string } | null
}> {
  const config = getLicenseConfig()
  
  if (!config) {
    return {
      configured: false,
      valid: false,
      info: null,
      config: null
    }
  }

  const license = await verifyLicense()
  
  return {
    configured: true,
    valid: license.valid,
    info: license,
    config: { domain: config.domain }
  }
}

// 清除授权缓存（配置更新后调用）
export function clearLicenseCache() {
  licenseCache = null
  lastVerifyTime = 0
}
