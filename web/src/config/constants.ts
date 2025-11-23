export const MODULE_ADDRESS = '0x0eE3B1A0544e1EA6b23fF1adb2b35Df5278B3914'

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
