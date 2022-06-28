/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable new-cap */

import { signTypedMessage, TypedMessage } from 'eth-sig-util'
import { toBuffer } from 'ethereumjs-util'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Wallet, BigNumber, constants } from 'ethers'
import { makeSnapshot, resetChain } from './utils'
import {
	ForwarderAccessControlUpgradeable,
	ForwarderUpgradeable,
	TestTarget,
	ExampleToken,
} from '../typechain-types'

interface MessageTypeProperty {
	name: string
	type: string
}
interface MessageTypes {
	EIP712Domain: MessageTypeProperty[]
	[additionalProperties: string]: MessageTypeProperty[]
}
const BALANCE_SUFFIX = '000000000000000000'
// TODO 警告の削除
// TODO トークンでガスを支払う処理を追加する
// TODO GenericMetaTxProcessorの足りない機能やセキュリティを実装する
// どこがどのEIPだかERC高を調べる
// permitのケースを記録しておく
// ERC20のテストケースに置き換える
// TODO bathからbatchを実行された時の対策
// TODO batchからexecuteされた時の対策
// batchの中で別のユーザの処理をしてもOKなことを確認
describe('MetaTransactionRelayer', () => {
	let relayer: ForwarderUpgradeable
	let target: TestTarget
	let control: ForwarderAccessControlUpgradeable
	let token: ExampleToken
	let snapshot: string

	type Message = {
		from: string
		to: string
		value: number
		gas: number
		nonce: number
		expiry: number
		data: string
	}

	const createMessage = async (
		from: string,
		to: string,
		value: number,
		gas: number,
		nonce: number,
		data: string
	): Promise<Message> => {
		const expiry = await getDeadLine()
		return {
			from,
			to,
			value,
			gas,
			nonce,
			expiry,
			data,
		}
	}

	const createMessageParam = async (
		message: Message,
		relayerAddress: string
	): Promise<TypedMessage<MessageTypes>> => {
		const chainId = await getChainId()
		return {
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
				],
			},
			primaryType: 'ForwardRequest',
			domain: {
				name: 'Forwarder',
				version: '0.0.1',
				chainId,
				verifyingContract: relayerAddress,
			},
			message,
		} as TypedMessage<MessageTypes>
	}

	const getChainId = async (): Promise<number> => {
		const network = await ethers.provider.getNetwork()
		const { chainId } = network
		return chainId
	}

	const getDeadLine = async (): Promise<number> => {
		const blockNumber = await ethers.provider.getBlockNumber()
		const blockInfo = await ethers.provider.getBlock(blockNumber)
		const deadline = blockInfo.timestamp + 100
		return deadline
	}

	before(async () => {
		const factory = await ethers.getContractFactory(
			'ForwarderAccessControlUpgradeable'
		)
		control = (await factory.deploy()) as ForwarderAccessControlUpgradeable
		await control.deployed()
		await control.initialize()

		const tokenFactory = await ethers.getContractFactory('ExampleToken')
		token = (await tokenFactory.deploy()) as ExampleToken
		await token.deployed()
		await token.initialize(control.address)

		const forwarderFactory = await ethers.getContractFactory(
			'ForwarderUpgradeable'
		)
		relayer = (await forwarderFactory.deploy()) as ForwarderUpgradeable
		await relayer.deployed()
		await relayer.initialize('Forwarder', '0.0.1')
		const executeRole = await relayer.EXECUTE_ROLE()
		const [signer] = await ethers.getSigners()

		await relayer.grantRole(executeRole, signer.address)
		await relayer.grantRole(executeRole, relayer.address)

		const targetFactory = await ethers.getContractFactory('TestTarget')
		target = (await targetFactory.deploy()) as TestTarget
		await target.deployed()
		await target.initialize(control.address)
		const forwarderRole = await control.FORWARDER_ROLE()
		await control.grantRole(forwarderRole, relayer.address)
	})
	beforeEach(async () => {
		snapshot = await makeSnapshot()
	})
	afterEach(async () => {
		await resetChain(snapshot)
	})
	it('forward', async () => {
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
		const message = await createMessage(
			userWallet.address,
			target.address,
			0,
			100000000,
			nonce.toNumber(),
			functionSignature
		)
		const msgParams = await createMessageParam(message, relayer.address)
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
			},
			signature
		)
		expect(await target.beforeSender()).to.equal(message.from)
		expect(await target.arg1()).to.equal(arg1Wallet.address)
		expect(await target.arg2()).to.equal(arg2Wallet.address)
		expect((await target.arg3()).toString()).to.equal(String(arg3))
	})
	it.only('pay token and mint nft', async () => {
		const userWallet = Wallet.createRandom()
		const arg1Wallet = Wallet.createRandom()
		const arg2Wallet = Wallet.createRandom()
		const arg3 = 192836
		await token.transfer(userWallet.address, '10' + BALANCE_SUFFIX)
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

		const message = await createMessage(
			userWallet.address,
			target.address,
			0,
			10000000,
			nonce.add(1).toNumber(),
			functionSignature
		)

		const msgParams = await createMessageParam(message, relayer.address)
		const signature = signTypedMessage(toBuffer(userWallet.privateKey), {
			data: msgParams,
		})
		const message2 = await createMessage(
			userWallet.address,
			target.address,
			0,
			10000000,
			nonce.add(2).toNumber(),
			functionSignature
		)
		const msgParams2 = await createMessageParam(message2, relayer.address)
		const signature2 = signTypedMessage(toBuffer(userWallet.privateKey), {
			data: msgParams2,
		})

		const iface3 = new ethers.utils.Interface([
			'function batch(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 expiry, bytes data)[] reqs, bytes[] signatures)',
		])
		const functionSignature3 = iface3.encodeFunctionData('batch', [
			[
				{
					from: message.from,
					to: message.to,
					value: message.value,
					gas: message.gas,
					nonce: message.nonce,
					expiry: message.expiry,
					data: message.data,
				},
				{
					from: message2.from,
					to: message2.to,
					value: message2.value,
					gas: message2.gas,
					nonce: message2.nonce,
					expiry: message2.expiry,
					data: message2.data,
				},
			],
			[signature, signature2],
		])
		const message3 = await createMessage(
			userWallet.address,
			relayer.address,
			0,
			100000000,
			nonce.toNumber(),
			functionSignature3
		)
		const msgParams3 = await createMessageParam(message3, relayer.address)
		const signature3 = signTypedMessage(toBuffer(userWallet.privateKey), {
			data: msgParams3,
		})
		await relayer.execute(
			{
				from: message3.from,
				to: message3.to,
				value: message3.value,
				gas: message3.gas,
				nonce: message3.nonce,
				expiry: message3.expiry,
				data: message3.data,
			},
			signature3
		)
	})
})
