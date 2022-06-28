/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable new-cap */

import { signTypedMessage, TypedMessage } from 'eth-sig-util'
import { toBuffer } from 'ethereumjs-util'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, Wallet, BigNumber, constants } from 'ethers'

interface MessageTypeProperty {
	name: string
	type: string
}
interface MessageTypes {
	EIP712Domain: MessageTypeProperty[]
	[additionalProperties: string]: MessageTypeProperty[]
}
// TODO警告の削除
// TODO トークンでガスを支払う処理を追加する
// TODO GenericMetaTxProcessorの足りない機能やセキュリティを実装する
// どこがどのEIPだかERC高を調べる
// permitのケースを記録しておく
describe('MetaTransactionRelayer', () => {
	let relayer: Contract
	let target: Contract
	before(async () => {
		const forwarderFactory = await ethers.getContractFactory(
			'ForwarderUpgradeable'
		)
		relayer = await forwarderFactory.deploy()
		await relayer.deployed()
		await relayer.initialize('Forwarder', '0.0.1')
		const executeRole = await relayer.EXECUTE_ROLE()
		const [signer] = await ethers.getSigners()

		await relayer.grantRole(executeRole, signer.address)

		const targetFactory = await ethers.getContractFactory('TestTarget')
		target = await targetFactory.deploy()
		await target.deployed()
		await target.initialize()
		const forwarderRole = await target.FORWARDER_ROLE()
		await target.grantRole(forwarderRole, relayer.address)
	})

	it.only('forward', async () => {
		const userWallet = Wallet.createRandom()
		const arg1Wallet = Wallet.createRandom()
		const arg2Wallet = Wallet.createRandom()
		const arg3 = 192836
		const iface = new ethers.utils.Interface([
			'function testFunc(address _arg1, address _arg2, uint256 _arg3)',
		])
		const functionSignature = iface.encodeFunctionData('testFunc', [
			arg1Wallet.address,
			arg2Wallet.address,
			arg3,
		])
		const nonce: BigNumber = await relayer.getNonce(userWallet.address)
		const network = await ethers.provider.getNetwork()
		const { chainId } = network

		const blockNumber = await ethers.provider.getBlockNumber()
		const blockInfo = await ethers.provider.getBlock(blockNumber)
		const deadline_ = blockInfo.timestamp + 100

		const message = {
			from: userWallet.address,
			to: target.address,
			value: 0,
			gas: 100000000,
			nonce: nonce.toNumber(),
			expiry: deadline_,
			data: functionSignature,
			token: constants.AddressZero,
			amount: 0,
		}
		const msgParams = {
			types: {
				EIP712Domain: [
					{ name: 'name', type: 'string' },
					{ name: 'version', type: 'string' },
					{ name: 'chainId', type: 'uint256' },
					{ name: 'verifyingContract', type: 'address' },
				],
				ForwardRequest: [
					{ name: 'from', type: 'address' },
					{ name: 'to', type: 'address' },
					{ name: 'value', type: 'uint256' },
					{ name: 'gas', type: 'uint256' },
					{ name: 'nonce', type: 'uint256' },
					{ name: 'expiry', type: 'uint256' },
					{ name: 'data', type: 'bytes' },
					{ name: 'token', type: 'address' },
					{ name: 'amount', type: 'uint256' },
				],
			},
			primaryType: 'ForwardRequest',
			domain: {
				name: 'Forwarder',
				version: '0.0.1',
				chainId,
				verifyingContract: relayer.address,
			},
			message,
		} as TypedMessage<MessageTypes>
		const signature = signTypedMessage(toBuffer(userWallet.privateKey), {
			data: msgParams,
		})
		expect(await target.beforeSender()).to.equal(constants.AddressZero)
		expect(await target.arg1()).to.equal(constants.AddressZero)
		expect(await target.arg2()).to.equal(constants.AddressZero)
		expect((await target.arg3()).toString()).to.equal('0')
		await relayer.execute(
			{
				from: message.from,
				to: message.to,
				value: message.value,
				gas: message.gas,
				nonce: message.nonce,
				expiry: message.expiry,
				data: message.data,
				token: message.token,
				amount: message.amount,
			},
			signature
		)
		expect(await target.beforeSender()).to.equal(message.from)
		expect(await target.arg1()).to.equal(arg1Wallet.address)
		expect(await target.arg2()).to.equal(arg2Wallet.address)
		expect((await target.arg3()).toString()).to.equal(String(arg3))
	})
})
