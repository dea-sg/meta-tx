/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable new-cap */
/* eslint-disable max-params */

import {
	signTypedData,
	TypedMessage,
	SignTypedDataVersion,
} from '@metamask/eth-sig-util'
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

	const transferPrepare = async (
		_nonce = -1,
		_expiry = -1,
		_value = 0
	): Promise<[Wallet, Wallet, Message, string]> => {
		const createTransferFuncEncoded = (): string => {
			const iface = new ethers.utils.Interface([
				'function transfer(address to, uint256 amount)',
			])
			const functionEncoded = iface.encodeFunctionData('transfer', [
				companyWallet.address,
				'10' + BALANCE_SUFFIX,
			])
			return functionEncoded
		}

		const userWallet = Wallet.createRandom()
		await token.transfer(userWallet.address, '10' + BALANCE_SUFFIX)
		const companyWallet = Wallet.createRandom()
		const functionEncoded = createTransferFuncEncoded()
		const nonce: BigNumber =
			_nonce === -1
				? await forwarder.getNonce(userWallet.address)
				: BigNumber.from(_nonce)
		const expiry = _expiry === -1 ? await getDeadLine() : _expiry
		const message = createMessage(
			userWallet.address,
			token.address,
			_value,
			100000000,
			nonce.toNumber(),
			expiry,
			functionEncoded
		)
		const msgParams = await createMessageParam(message, forwarder.address)
		const signature = signTypedData({
			privateKey: toBuffer(userWallet.privateKey),
			data: msgParams,
			version: SignTypedDataVersion.V4,
		})
		return [userWallet, companyWallet, message, signature]
	}

	const executePrepare = async (): Promise<
		[Wallet, Wallet, Message, string]
	> => {
		const userWallet = Wallet.createRandom()
		const companyWallet = Wallet.createRandom()
		const iface = new ethers.utils.Interface([
			'function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 expiry, bytes data) req, bytes signature)',
		])
		const nextMessage = createMessage(
			ethers.constants.AddressZero,
			ethers.constants.AddressZero,
			0,
			0,
			0,
			0,
			'0x'
		)
		const functionEncoded = iface.encodeFunctionData('execute', [
			nextMessage,
			'0x',
		])
		const nonce: BigNumber = await forwarder.getNonce(userWallet.address)
		const expiry = await getDeadLine()
		const message = createMessage(
			userWallet.address,
			forwarder.address,
			0,
			100000000,
			nonce.toNumber(),
			expiry,
			functionEncoded
		)
		const msgParams = await createMessageParam(message, forwarder.address)
		const signature = signTypedData({
			privateKey: toBuffer(userWallet.privateKey),
			data: msgParams,
			version: SignTypedDataVersion.V4,
		})
		return [userWallet, companyWallet, message, signature]
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
	describe('initialize', () => {
		describe('fail', () => {
			it('Cannot be executed more than once', async () => {
				await expect(
					forwarder.initialize('Forwarder', '0.0.1')
				).to.be.revertedWith('Initializable: contract is already initialized')
			})
		})
	})
	describe('getNonce', () => {
		describe('success', () => {
			it('default nonce is 0', async () => {
				const userWallet = Wallet.createRandom()
				const nonce: BigNumber = await forwarder.getNonce(userWallet.address)
				expect(nonce.toString()).to.equal('0')
			})
			it('incriment nonce', async () => {
				const [userWallet, , message, signature] = await transferPrepare()
				const nonce: BigNumber = await forwarder.getNonce(userWallet.address)
				expect(nonce.toString()).to.equal('0')
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
				const nonceNext: BigNumber = await forwarder.getNonce(
					userWallet.address
				)
				expect(nonceNext.toString()).to.equal('1')
			})
		})
	})

	describe('pause', () => {
		describe('success', () => {
			it('revoke execute role', async () => {
				const executeRole = await forwarder.EXECUTE_ROLE()
				await forwarder.pause()
				const [admin] = await ethers.getSigners()
				const hasExecuteRole = await forwarder.hasRole(
					executeRole,
					admin.address
				)
				expect(hasExecuteRole).to.equal(false)
				const adminRole = await forwarder.DEFAULT_ADMIN_ROLE()
				const hasAdminRole = await forwarder.hasRole(adminRole, admin.address)
				expect(hasAdminRole).to.equal(true)
			})
			it('revoke execute role or all executer', async () => {
				const [admin, user] = await ethers.getSigners()
				const executeRole = await forwarder.EXECUTE_ROLE()
				await forwarder.grantRole(executeRole, user.address)
				let hasExecuteRole = await forwarder.hasRole(executeRole, admin.address)
				expect(hasExecuteRole).to.equal(true)
				hasExecuteRole = await forwarder.hasRole(executeRole, user.address)
				expect(hasExecuteRole).to.equal(true)
				await forwarder.pause()
				hasExecuteRole = await forwarder.hasRole(executeRole, admin.address)
				expect(hasExecuteRole).to.equal(false)
				hasExecuteRole = await forwarder.hasRole(executeRole, user.address)
				expect(hasExecuteRole).to.equal(false)
			})
		})
		describe('fail', () => {
			it('admin only', async () => {
				const [, user] = await ethers.getSigners()
				const forwarderUser = forwarder.connect(user)
				const adminRole = await forwarder.DEFAULT_ADMIN_ROLE()
				const errorMsg = `AccessControl: account ${user.address.toLowerCase()} is missing role ${adminRole}`
				await expect(forwarderUser.pause()).to.be.revertedWith(errorMsg)
			})
		})
	})

	describe('execute', () => {
		describe('success', () => {
			it('erc20 transfer', async () => {
				const [kicker] = await ethers.getSigners()
				const [userWallet, companyWallet, message, signature] =
					await transferPrepare()
				const userEthBalance = await ethers.provider.getBalance(
					userWallet.address
				)
				expect(userEthBalance.toString()).to.equal('0')
				expect(userEthBalance.toString()).to.equal('0')
				const userTokenBalance = await token.balanceOf(userWallet.address)
				expect(userTokenBalance.toString()).to.equal('10' + BALANCE_SUFFIX)
				const companyTokenBalance = await token.balanceOf(companyWallet.address)
				expect(companyTokenBalance.toString()).to.equal('0')
				const kickerEthbalance = await ethers.provider.getBalance(
					kicker.address
				)

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
				const userEthBalanceAfter = await ethers.provider.getBalance(
					userWallet.address
				)
				expect(userEthBalanceAfter.toString()).to.equal('0')
				const userTokenBalanceAfter = await token.balanceOf(userWallet.address)
				expect(userTokenBalanceAfter.toString()).to.equal('0')
				const companyTokenBalanceAfter = await token.balanceOf(
					companyWallet.address
				)
				expect(companyTokenBalanceAfter.toString()).to.equal(
					'10' + BALANCE_SUFFIX
				)
				const kickerEthbalanceAfter = await ethers.provider.getBalance(
					kicker.address
				)
				const usedGas = kickerEthbalance.sub(kickerEthbalanceAfter)
				expect(usedGas.gt(0)).to.equal(true)
			})
			it('increment nonce', async () => {
				const [userWallet, , message, signature] = await transferPrepare()

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
				const nonce = await forwarder.getNonce(userWallet.address)
				expect(nonce.toString()).to.equal('1')
			})
			it('send value', async () => {
				// Const iface = new ethers.utils.Interface([
				// 	'function payableFunc()',
				// ])
				// const functionEncoded = iface.encodeFunctionData('payableFunc', [])
				// console.log(functionEncoded)
				// const [, , message, signature] = await transferPrepare(-1, -1, 1000000000, '0x')
				// const [kicker] = await ethers.getSigners()
				// const tx = {
				// 	to: message.from,
				// 	value: BigNumber.from(1000000000)
				// }
				// await kicker.sendTransaction(tx)
				// const fromBalance = await ethers.provider.getBalance(message.from)
				// expect(fromBalance.toString()).to.equal('1000000000')
				// const toBalance = await ethers.provider.getBalance(message.to)
				// expect(toBalance.toString()).to.equal('0')
				// console.log(message)
				// console.log(message.data)
				// await forwarder.execute(
				// 	{
				// 		from: message.from,
				// 		to: message.to,
				// 		value: message.value,
				// 		gas: message.gas,
				// 		nonce: message.nonce,
				// 		expiry: message.expiry,
				// 		data: message.data,
				// 	},
				// 	signature
				// )
				// console.log(2222)
				// const fromBalanceAfter = await ethers.provider.getBalance(message.from)
				// expect(fromBalanceAfter.toString()).to.equal('0')
				// console.log(3333)
				// const toBalanceAfter = await ethers.provider.getBalance(message.to)
				// expect(toBalanceAfter.toString()).to.equal('10')
			})
			it('generate event', async () => {
				const [, , message, signature] = await transferPrepare()
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
				const filter = forwarder.filters.MetaTransaction()
				const events = await forwarder.queryFilter(filter)
				const event = events[0].args
				expect(event.from).to.equal(message.from)
				expect(event.nonce.toNumber()).to.equal(message.nonce)
				expect(event.to).to.equal(message.to)
				expect(event.value.toNumber()).to.equal(message.value)
				expect(event.gas.toNumber()).to.equal(message.gas)
				expect(event.expiry.toNumber()).to.equal(message.expiry)
				expect(event.success).to.equal(true)
				const result = new ethers.utils.AbiCoder().decode(
					['bool'],
					event.returnData
				)
				expect(result[0]).to.equal(true)
			})
		})
		describe('fail', () => {
			it('has no execute role', async () => {
				const [, user] = await ethers.getSigners()
				const [, , message, signature] = await transferPrepare()
				const executeRole = await forwarder.EXECUTE_ROLE()
				const errorMsg = `AccessControl: account ${user.address.toLowerCase()} is missing role ${executeRole}`
				const forwarderUser = forwarder.connect(user)
				await expect(
					forwarderUser.execute(
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
				).to.be.revertedWith(errorMsg)
			})
			it('lock', async () => {
				const executeRole = await forwarder.EXECUTE_ROLE()
				await forwarder.grantRole(executeRole, forwarder.address)
				const [, , message, signature] = await executePrepare()
				await expect(
					forwarder.execute(
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
				).to.be.revertedWith('call error')
			})
			describe('verify', () => {
				it('illegal nonce', async () => {
					const [, , message, signature] = await transferPrepare(100)
					await expect(
						forwarder.execute(
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
					).to.be.revertedWith('illegal nonce')
				})
				it('illegal expired', async () => {
					const [, , message, signature] = await transferPrepare(-1, 1)
					await expect(
						forwarder.execute(
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
					).to.be.revertedWith('expired')
				})
				it('illegal signer', async () => {
					const [, , message, signature] = await transferPrepare()
					await expect(
						forwarder.execute(
							{
								from: ethers.constants.AddressZero,
								to: message.to,
								value: message.value,
								gas: message.gas,
								nonce: message.nonce,
								expiry: message.expiry,
								data: message.data,
							},
							signature
						)
					).to.be.revertedWith('illegal signer')
				})
			})
		})
	})

	describe('batch', () => {
		describe('success', () => {
			it('pay token and mint nft', async () => {
				const [kicker] = await ethers.getSigners()
				const minterWallet = Wallet.createRandom()
				const batchWallet = Wallet.createRandom()
				const [
					userWallet,
					companyWallet,
					messageTokenTransfer,
					signatureTokenTransfer,
				] = await transferPrepare()

				const userEthBalance = await ethers.provider.getBalance(
					userWallet.address
				)
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
				const minterNonce = await forwarder.getNonce(minterWallet.address)
				const expiry = await getDeadLine()
				const messageNftMint = createMessage(
					minterWallet.address,
					nft.address,
					0,
					100000000,
					minterNonce.toNumber(),
					expiry,
					functionEncodedNftMint
				)
				const msgParamsNftMint = await createMessageParam(
					messageNftMint,
					forwarder.address
				)

				const signatureNftMint = signTypedData({
					privateKey: toBuffer(minterWallet.privateKey),
					data: msgParamsNftMint,
					version: SignTypedDataVersion.V4,
				})

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
				const batchNonce = await forwarder.getNonce(batchWallet.address)
				const messageBatch = createMessage(
					batchWallet.address,
					forwarder.address,
					0,
					100000000,
					batchNonce.toNumber(),
					expiry,
					functionEncodedBatch
				)
				const msgParamsBatch = await createMessageParam(
					messageBatch,
					forwarder.address
				)

				const signatureBatch = signTypedData({
					privateKey: toBuffer(batchWallet.privateKey),
					data: msgParamsBatch,
					version: SignTypedDataVersion.V4,
				})
				const kickerEthbalance = await ethers.provider.getBalance(
					kicker.address
				)
				await forwarder.execute(
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
				expect(companyTokenBalanceAfter.toString()).to.equal(
					'10' + BALANCE_SUFFIX
				)
				const userNftBalanceAfter = await nft.balanceOf(userWallet.address)
				expect(userNftBalanceAfter.toString()).to.equal('1')
				const owner = await nft.ownerOf(1)
				expect(owner).to.equal(userWallet.address)
				const kickerEthbalanceAfter = await ethers.provider.getBalance(
					kicker.address
				)
				const usedGas = kickerEthbalance.sub(kickerEthbalanceAfter)
				expect(usedGas.gt(0)).to.equal(true)
			})
		})
		describe('fail', () => {
			it('Cannot be executed from the outside', async () => {
				await expect(forwarder.batch([], [])).to.be.revertedWith(
					'inner execute only'
				)
			})
			it('Arguments must have the same number of arrays to be executed.', async () => {
				await expect(forwarder.batch([], ['0x'])).to.be.revertedWith(
					'illegal params'
				)
			})
		})
	})
})
