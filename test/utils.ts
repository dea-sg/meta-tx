import { network } from 'hardhat'

export const makeSnapshot = async (): Promise<string> => {
	const snapshot = await network.provider.request({ method: 'evm_snapshot' })
	return typeof snapshot === 'string' ? snapshot : ''
}

export const resetChain = async (snapshot: string): Promise<void> => {
	await network.provider.request({
		method: 'evm_revert',
		params: [snapshot],
	})
}
