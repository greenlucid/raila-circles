export const MODULE_ADDRESS = '0xB877459e28ae22B6CE214a3af7b3dcEC96fB8ca4'

export const SAFE_ABI = [{
  name: 'isModuleEnabled',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'module', type: 'address' }],
  outputs: [{ name: '', type: 'bool' }],
}, {
  name: 'enableModule',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'module', type: 'address' }],
  outputs: [],
}] as const
