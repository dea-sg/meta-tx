/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable new-cap */
/* eslint-disable max-params */

import { signTypedMessage, TypedMessage } from 'eth-sig-util'
import { toBuffer } from 'ethereumjs-util'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Wallet, BigNumber } from 'ethers'
import { makeSnapshot, resetChain } from './utils'
import {
	ForwarderAccessControlUpgradeable,
	ForwarderUpgradeable,
	ExampleToken,
	TestNFT,
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

// EIP4337
// https://twitter.com/yamapyblack/status/1541790750798512128?s=20&t=BuWUcyvc5QLr3VjbPIiNlw
// https://zenn.dev/sivira/articles/d041f1ac44ca1e
// https://twitter.com/ccassets/status/1541940760454778880?s=12&t=hHr4bCWW71Z5DUtZvfjHfg

// どこがどのEIPだかERCだかを調べる

describe('MetaTransactionRelayer', () => {
	let relayer: ForwarderUpgradeable
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
		relayer = (await forwarderFactory.deploy()) as ForwarderUpgradeable
		await relayer.deployed()
		await relayer.initialize('Forwarder', '0.0.1')
		const executeRole = await relayer.EXECUTE_ROLE()

		await relayer.grantRole(executeRole, signer.address)

		const forwarderRole = await control.FORWARDER_ROLE()
		await control.grantRole(forwarderRole, relayer.address)

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
	it.only('erc20 transfer', async () => {
		const userWallet = Wallet.createRandom()
		await token.transfer(userWallet.address, '10' + BALANCE_SUFFIX)
		const companyWallet = Wallet.createRandom()
		const iface = new ethers.utils.Interface([
			'function transfer(address to, uint256 amount)',
		])
		const functionEncoded = iface.encodeFunctionData('transfer', [
			companyWallet.address,
			'10' + BALANCE_SUFFIX,
		])
		const nonce: BigNumber = await relayer.getNonce(userWallet.address)
		const message = await createMessage(
			userWallet.address,
			token.address,
			0,
			100000000,
			nonce.toNumber(),
			functionEncoded
		)
		const msgParams = await createMessageParam(message, relayer.address)
		const signature = signTypedMessage(toBuffer(userWallet.privateKey), {
			data: msgParams,
		})

		const userEthBalance = await ethers.provider.getBalance(userWallet.address)
		expect(userEthBalance.toString()).to.equal('0')
		const userTokenBalance = await token.balanceOf(userWallet.address)
		expect(userTokenBalance.toString()).to.equal('10' + BALANCE_SUFFIX)
		const companyTokenBalance = await token.balanceOf(companyWallet.address)
		expect(companyTokenBalance.toString()).to.equal('0')
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
		const userEthBalanceAfter = await ethers.provider.getBalance(
			userWallet.address
		)
		expect(userEthBalanceAfter.toString()).to.equal('0')
		const userTokenBalanceAfter = await token.balanceOf(userWallet.address)
		expect(userTokenBalanceAfter.toString()).to.equal('0')
		const companyTokenBalanceAfter = await token.balanceOf(
			companyWallet.address
		)
		expect(companyTokenBalanceAfter.toString()).to.equal('10' + BALANCE_SUFFIX)
	})
	it.only('pay token and mint nft', async () => {
		// 登場人物
		const userWallet = Wallet.createRandom()
		const companyWallet = Wallet.createRandom()
		const minterWallet = Wallet.createRandom()
		const batchWallet = Wallet.createRandom()

		// Token transfer
		await token.transfer(userWallet.address, '10' + BALANCE_SUFFIX)
		const ifaceTokenTransfer = new ethers.utils.Interface([
			'function transfer(address to, uint256 amount)',
		])
		const functionEncodedTokenTransfer = ifaceTokenTransfer.encodeFunctionData(
			'transfer',
			[companyWallet.address, '10' + BALANCE_SUFFIX]
		)
		const userNonce = await relayer.getNonce(userWallet.address)
		const messageTokenTransfer = await createMessage(
			userWallet.address,
			token.address,
			0,
			100000000,
			userNonce.toNumber(),
			functionEncodedTokenTransfer
		)
		const msgParamsTokenTransfer = await createMessageParam(
			messageTokenTransfer,
			relayer.address
		)
		const signatureTokenTransfer = signTypedMessage(
			toBuffer(userWallet.privateKey),
			{
				data: msgParamsTokenTransfer,
			}
		)

		const userEthBalance = await ethers.provider.getBalance(userWallet.address)
		expect(userEthBalance.toString()).to.equal('0')
		const userTokenBalance = await token.balanceOf(userWallet.address)
		expect(userTokenBalance.toString()).to.equal('10' + BALANCE_SUFFIX)
		const companyTokenBalance = await token.balanceOf(companyWallet.address)
		expect(companyTokenBalance.toString()).to.equal('0')

		// Nft mint
		const mintRole = await nft.MINT_ROLE()
		await nft.grantRole(mintRole, minterWallet.address)
		const ifaceNftMint = new ethers.utils.Interface([
			'function mint(address to, uint256 tokenId)',
		])
		const functionEncodedNftMint = ifaceNftMint.encodeFunctionData('mint', [
			userWallet.address,
			1,
		])
		const minterNonce = await relayer.getNonce(minterWallet.address)
		const messageNftMint = await createMessage(
			minterWallet.address,
			nft.address,
			0,
			100000000,
			minterNonce.toNumber(),
			functionEncodedNftMint
		)
		const msgParamsNftMint = await createMessageParam(
			messageNftMint,
			relayer.address
		)
		const signatureNftMint = signTypedMessage(
			toBuffer(minterWallet.privateKey),
			{
				data: msgParamsNftMint,
			}
		)

		const userNftBalance = await nft.balanceOf(userWallet.address)
		expect(userNftBalance.toString()).to.equal('0')

		// Batch
		const ifaceBatch = new ethers.utils.Interface([
			'function batch(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 expiry, bytes data)[] reqs, bytes[] signatures)',
		])
		const functionEncodedBatch = ifaceBatch.encodeFunctionData('batch', [
			[
				{
					from: messageTokenTransfer.from,
					to: messageTokenTransfer.to,
					value: messageTokenTransfer.value,
					gas: messageTokenTransfer.gas,
					nonce: messageTokenTransfer.nonce,
					expiry: messageTokenTransfer.expiry,
					data: messageTokenTransfer.data,
				},
				{
					from: messageNftMint.from,
					to: messageNftMint.to,
					value: messageNftMint.value,
					gas: messageNftMint.gas,
					nonce: messageNftMint.nonce,
					expiry: messageNftMint.expiry,
					data: messageNftMint.data,
				},
			],
			[signatureTokenTransfer, signatureNftMint],
		])
		const batchNonce = await relayer.getNonce(batchWallet.address)
		const messageBatch = await createMessage(
			batchWallet.address,
			relayer.address,
			0,
			100000000,
			batchNonce.toNumber(),
			functionEncodedBatch
		)
		const msgParamsBatch = await createMessageParam(
			messageBatch,
			relayer.address
		)
		const signatureBatch = signTypedMessage(toBuffer(batchWallet.privateKey), {
			data: msgParamsBatch,
		})
		await relayer.execute(
			{
				from: messageBatch.from,
				to: messageBatch.to,
				value: messageBatch.value,
				gas: messageBatch.gas,
				nonce: messageBatch.nonce,
				expiry: messageBatch.expiry,
				data: messageBatch.data,
			},
			signatureBatch
		)
		const userTokenBalanceAfter = await token.balanceOf(userWallet.address)
		expect(userTokenBalanceAfter.toString()).to.equal('0')
		const companyTokenBalanceAfter = await token.balanceOf(
			companyWallet.address
		)
		expect(companyTokenBalanceAfter.toString()).to.equal('10' + BALANCE_SUFFIX)
		const userNftBalanceAfter = await nft.balanceOf(userWallet.address)
		expect(userNftBalanceAfter.toString()).to.equal('1')
		const owner = await nft.ownerOf(1)
		expect(owner).to.equal(userWallet.address)
	})
})
