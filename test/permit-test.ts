/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable no-warning-comments */
/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable new-cap */

// TODO これらの警告も削除する
import { signTypedMessage, TypedMessage } from 'eth-sig-util'
import { toBuffer, fromRpcSig } from 'ethereumjs-util'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, Wallet } from 'ethers'

interface MessageTypeProperty {
	name: string
	type: string
}
interface MessageTypes {
	EIP712Domain: MessageTypeProperty[]
	[additionalProperties: string]: MessageTypeProperty[]
}

// ERC20Permitの実行例として残しておく
describe('TestPermitERC20', () => {
	let dep: Contract
	const buildData = async (
		chainId: number,
		verifyingContract: string,
		ownerWallet: Wallet,
		spenderWallet: Wallet,
		deadline: number
	): Promise<TypedMessage<MessageTypes>> => {
		const EIP712Domain = [
			{
				name: 'name',
				type: 'string',
			},
			{
				name: 'version',
				type: 'string',
			},
			{
				name: 'chainId',
				type: 'uint256',
			},
			{
				name: 'verifyingContract',
				type: 'address',
			},
		]
		const Permit = [
			{ name: 'owner', type: 'address' },
			{ name: 'spender', type: 'address' },
			{ name: 'value', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		]
		const _name = 'TEST Coin'
		const version = '1'
		const owner = ownerWallet.address
		const spender = spenderWallet.address
		const value = 10000000
		const nonce = await dep.nonces(owner)
		const nonce_ = nonce.toNumber()
		return {
			primaryType: 'Permit',
			types: { EIP712Domain, Permit },
			domain: { name: _name, version, chainId, verifyingContract },
			message: { owner, spender, value, nonce: nonce_, deadline },
		}
	}

	before(async () => {
		const wrappedDEPFactory = await ethers.getContractFactory('TestPermitERC20')
		const wrappedDEPInstance = await wrappedDEPFactory.deploy()
		dep = await wrappedDEPInstance.deployed()
	})

	it('domain separator', async () => {
		const network = await ethers.provider.getNetwork()
		const { chainId } = network
		const name_ = 'TEST Coin'
		const version = '1'
		const verifyingContract = await dep.address
		const domain = await dep.DOMAIN_SEPARATOR()
		const hash = await ethers.utils._TypedDataEncoder.hashDomain({
			name: name_,
			version,
			chainId,
			verifyingContract,
		})
		expect(domain).to.equal(hash)
	})
	it('permit', async () => {
		const network = await ethers.provider.getNetwork()
		const { chainId } = network
		const ownerWallet = Wallet.createRandom()
		const spenderWallet = Wallet.createRandom()
		const blockNumber = await ethers.provider.getBlockNumber()
		const ttt = await ethers.provider.getBlock(blockNumber)
		const deadline_ = ttt.timestamp + 100

		const before = await dep.allowance(
			ownerWallet.address,
			spenderWallet.address
		)
		expect(before.toString()).to.equal('0')

		const data = await buildData(
			chainId,
			dep.address,
			ownerWallet,
			spenderWallet,
			deadline_
		)
		const signature = signTypedMessage(toBuffer(ownerWallet.privateKey), {
			data,
		})
		const { v, r, s } = fromRpcSig(signature)
		await dep.permit(
			ownerWallet.address,
			spenderWallet.address,
			10000000,
			deadline_,
			v,
			r,
			s
		)
		const after = await dep.allowance(
			ownerWallet.address,
			spenderWallet.address
		)
		expect(after.toString()).to.equal('10000000')
	})
})
