// Real on-chain anchoring on testnet using the user's wallet (MetaMask).
// The SHA-256 fingerprint is written into the data field of a zero-value transaction.
// Anyone can later read that transaction from a public RPC (no wallet needed) and compare.

// Supported test networks. Sepolia is the default; Amoy records already sealed keep working.
export const NETWORKS = {
  sepolia: {
    label: 'Ethereum Sepolia testnet',
    chainId: '0xaa36a7', // 11155111
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org'],
    explorer: 'https://sepolia.etherscan.io',
    short: 'Ethereum Sepolia',
  },
  amoy: {
    label: 'Polygon Amoy testnet',
    chainId: '0x13882', // 80002
    chainName: 'Polygon Amoy Testnet',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://rpc-amoy.polygon.technology', 'https://polygon-amoy-bor-rpc.publicnode.com'],
    explorer: 'https://amoy.polygonscan.com',
    short: 'Polygon Amoy',
  },
}

// Wallets refuse transactions that carry data when sent to the user's own account,
// so fingerprints are anchored in a zero-value transaction to this fixed public address.
export const ANCHOR_ADDRESS = '0x000000000000000000000000000000000000dEaD'

export const ACTIVE = NETWORKS.sepolia
export const NETWORK_LABEL = ACTIVE.label
export const SIMULATED_LABEL = 'Simulated testnet'

/** Which real network a stored record belongs to (or null if simulated). */
export function netOf(networkLabel) {
  const l = (networkLabel || '').toLowerCase()
  if (l.startsWith('ethereum sepolia')) return NETWORKS.sepolia
  if (l.startsWith('polygon amoy')) return NETWORKS.amoy
  return null
}

export function isOnChainRecord(record) {
  return !!record?.txHash && !!netOf(record?.network)
}

export function explorerTxUrl(txHash, networkLabel = NETWORK_LABEL) {
  const n = netOf(networkLabel) || ACTIVE
  return `${n.explorer}/tx/${txHash}`
}

export function hasWallet() {
  return typeof window !== 'undefined' && !!window.ethereum
}

function randomHex64() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function rpc(net, method, params) {
  let lastErr
  for (const url of net.rpcUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message || 'RPC error')
      return json.result
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('RPC unreachable')
}

async function ensureNetwork(eth, net) {
  const current = await eth.request({ method: 'eth_chainId' })
  if (current === net.chainId) return
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainId }] })
  } catch (err) {
    // 4902 = chain not added yet in this wallet
    if (err?.code === 4902 || /unrecognized chain|not been added/i.test(err?.message || '')) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: net.chainId,
          chainName: net.chainName,
          nativeCurrency: net.nativeCurrency,
          rpcUrls: net.rpcUrls,
          blockExplorerUrls: [net.explorer],
        }],
      })
    } else {
      throw err
    }
  }
}

async function waitForReceipt(net, txHash, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await rpc(net, 'eth_getTransactionReceipt', [txHash])
      if (r) return r
    } catch { /* keep polling */ }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return null
}

/**
 * Seal a fingerprint. Returns { txHash, network, onChain, note }.
 * Tries the real chain first when a wallet is present; falls back to a simulated
 * record (clearly labelled) if there is no wallet or the user declines / it fails.
 */
export async function sealFingerprint(sha256) {
  const simulated = (note) => ({
    txHash: '0x' + randomHex64(),
    network: SIMULATED_LABEL,
    onChain: false,
    note,
  })

  if (!hasWallet()) {
    return simulated('No wallet found, sealed in simulated mode.')
  }
  try {
    const eth = window.ethereum
    const accounts = await eth.request({ method: 'eth_requestAccounts' })
    const from = accounts?.[0]
    if (!from) return simulated('No wallet account, sealed in simulated mode.')
    await ensureNetwork(eth, ACTIVE)
    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: ANCHOR_ADDRESS, value: '0x0', data: '0x' + sha256 }],
    })
    await waitForReceipt(ACTIVE, txHash)
    return { txHash, network: NETWORK_LABEL, onChain: true, note: '' }
  } catch (err) {
    console.error('[Saakshya] on-chain seal failed:', err)
    const rejected = err?.code === 4001 || /reject|denied/i.test(err?.message || '')
    const reason = String(err?.message || err || '').replace(/\s+/g, ' ').slice(0, 140)
    return simulated(
      rejected
        ? 'Wallet request was declined, sealed in simulated mode.'
        : `Blockchain step failed (${reason}). Sealed in simulated mode.`
    )
  }
}

/**
 * Check on a public RPC (no wallet needed) that the transaction carries this fingerprint.
 * Returns { status: 'match' | 'mismatch' | 'pending' | 'error', block? }
 */
export async function verifyOnChain(txHash, sha256, networkLabel = NETWORK_LABEL) {
  try {
    const net = netOf(networkLabel) || ACTIVE
    const tx = await rpc(net, 'eth_getTransactionByHash', [txHash])
    if (!tx) return { status: 'pending' }
    if (!tx.blockNumber) return { status: 'pending' }
    const data = (tx.input || '').toLowerCase()
    if (data === ('0x' + sha256).toLowerCase()) {
      return { status: 'match', block: parseInt(tx.blockNumber, 16) }
    }
    return { status: 'mismatch' }
  } catch {
    return { status: 'error' }
  }
}
