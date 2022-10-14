/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable new-cap */
/* eslint-disable max-params */

import type { TypedMessage } from '@metamask/eth-sig-util'
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util'
import { toBuffer } from 'ethereumjs-util'
import { expect, use } from 'chai'
import { ethers } from 'hardhat'
import { solidity } from 'ethereum-waffle'
import * as t from 'chai-as-promised'
import { Wallet } from 'ethers'
import { makeSnapshot, resetChain } from './utils'
import type {
	ForwarderAccessControlUpgradeable,
	ForwarderUpgradeable,
	ExampleToken,
	TestNFT,
} from '../typechain-types'

use(solidity)
use(t.default)

type MessageTypeProperty = {
	name: string
	type: string
}
type MessageTypes = {
	EIP712Domain: MessageTypeProperty[]
	[additionalProperties: string]: MessageTypeProperty[]
}

describe('ForwarderUpgradeable', () => {
	let forwarder: ForwarderUpgradeable
	let control: ForwarderAccessControlUpgradeable
	let token: ExampleToken
	let nft: TestNFT
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

	const createMessage = (
		from: string,
		to: string,
		value: number,
		gas: number,
		nonce: number,
		expiry: number,
		data: string
	): Message => ({
		from,
		to,
		value,
		gas,
		nonce,
		expiry,
		data,
	})

	const createMessageParam = async (
		message: Message,
		forwarderAddress: string
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
				verifyingContract: forwarderAddress,
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

	const getItemId = (): number =>
		// 1から10
		Math.floor(Math.random() * 10) + 1

	before(async () => {
		const [signer] = await ethers.getSigners()
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
		forwarder = (await forwarderFactory.deploy()) as ForwarderUpgradeable
		await forwarder.deployed()
		await forwarder.initialize('Forwarder', '0.0.1')
		const executeRole = await forwarder.EXECUTE_ROLE()

		await forwarder.grantRole(executeRole, signer.address)

		const forwarderRole = await control.FORWARDER_ROLE()
		await control.grantRole(forwarderRole, forwarder.address)

		const testNFTFactory = await ethers.getContractFactory('TestNFT')
		nft = (await testNFTFactory.deploy()) as TestNFT
		await nft.deployed()
		await nft.initialize(control.address)
	})
	beforeEach(async () => {
		snapshot = await makeSnapshot()
	})
	afterEach(async () => {
		await resetChain(snapshot)
	})

	describe('execute', () => {
		describe('success', () => {
			it('gacha', async () => {
				// 登場wallet
				// api apiサーバのウォレット
				// user ゲームプレイヤーのウォレット
				const [api] = await ethers.getSigners()
				const user = Wallet.createRandom()

				// 事前準備、権限設定
				// fowarderからmintできるように権限設定
				await nft.setForwarder(forwarder.address)
				// ガチャのitemidを保存するための権限
				const itemRole = await nft.ITEM_ROLE()
				await nft.grantRole(itemRole, api.address)

				// ここからユーザのブラウザで行われる処理
				const nonce = await forwarder.getNonce(user.address)

				const iface = new ethers.utils.Interface([
					'function mintItem(address to, uint256 nonce)',
				])
				const functionEncoded = iface.encodeFunctionData('mintItem', [
					user.address,
					nonce.toNumber(),
				])
				const expiry = await getDeadLine()
				const gas = 100000000
				const message = createMessage(
					user.address,
					nft.address,
					0,
					gas,
					nonce.toNumber(),
					expiry,
					functionEncoded
				)
				const msgParams = await createMessageParam(message, forwarder.address)
				const signature = signTypedData({
					privateKey: toBuffer(user.privateKey),
					data: msgParams,
					version: SignTypedDataVersion.V4,
				})

				// ここからAPIの処理、APIにmessageとsignatureを渡す
				// ガチャ実行
				const itemId = getItemId()
				console.log(`item id:${itemId}`)

				// このタイミングでDBのトランザクション開始

				// 本来ならこのタイミングでDEPの減算処理

				// ガチャの結果セット
				// itemIdはサーバサイドで決定する必要があるため、関数実行情報署名時にはわからない
				// なので、このタイミングでコントラクトに渡しておく
				await nft.setKey(message.from, message.nonce, itemId)

				// メタトラ実行
				await forwarder.execute(
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
				const filter = nft.filters.Transfer()
				const events = await nft.queryFilter(filter)
				const event = events[0].args
				expect(event.to).to.equal(user.address)
				const tokenId = itemId * 1000
				expect(event.tokenId.toNumber()).to.equal(tokenId)

				// 全てがうまくいった場合、DBのトランザクションをコミット
				// ダメだった場合はロールバック

				// token idをユーザのブラウザに返却する
			})
		})
	})
})
