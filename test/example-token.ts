/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/naming-convention */
import { expect, use } from 'chai'
import { ethers } from 'hardhat'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { makeSnapshot, resetChain } from './utils'
import type {
	ExampleToken,
	MinimalForwarder,
	ForwarderAccessControlUpgradeable,
} from '../typechain-types'

use(solidity)

describe('Example', () => {
	let example: ExampleToken
	let control: ForwarderAccessControlUpgradeable
	let forwarder: MinimalForwarder
	let snapshot: string
	const BALANCE_SUFFIX = '000000000000000000'
	before(async () => {
		const factory = await ethers.getContractFactory(
			'ForwarderAccessControlUpgradeable'
		)
		control = (await factory.deploy()) as ForwarderAccessControlUpgradeable
		await control.deployed()
		await control.initialize()

		const exampleFactory = await ethers.getContractFactory('ExampleToken')
		example = (await exampleFactory.deploy()) as ExampleToken
		await example.deployed()
		await example.initialize(control.address)

		const forwarderFactory = await ethers.getContractFactory('MinimalForwarder')
		forwarder = (await forwarderFactory.deploy()) as MinimalForwarder
		await forwarder.deployed()

		const forwarderRole = await control.FORWARDER_ROLE()
		await control.grantRole(forwarderRole, forwarder.address)
	})
	beforeEach(async () => {
		snapshot = await makeSnapshot()
	})
	afterEach(async () => {
		await resetChain(snapshot)
	})
	describe('name', () => {
		it('check name', async () => {
			const value = await example.name()
			expect(value.toString()).to.equal('token')
		})
	})
	describe('symbol', () => {
		it('check symbol', async () => {
			const symbol = await example.symbol()
			expect(symbol.toString()).to.equal('TOKEN')
		})
	})

	describe('transfer', () => {
		it('trasnfer token', async () => {
			const [deployer] = await ethers.getSigners()
			const otherUser = Wallet.createRandom()
			const beforeDeployerBalance = await example.balanceOf(deployer.address)
			expect(beforeDeployerBalance.toString()).to.equal('100' + BALANCE_SUFFIX)
			const beforeOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(beforeOtherUserBalance.toString()).to.equal('0')

			await example.transfer(otherUser.address, '10' + BALANCE_SUFFIX)

			const afterDeployerBalance = await example.balanceOf(deployer.address)
			expect(afterDeployerBalance.toString()).to.equal('90' + BALANCE_SUFFIX)
			const afterOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(afterOtherUserBalance.toString()).to.equal('10' + BALANCE_SUFFIX)
		})
		it('trasnfer token by forwader', async () => {
			const [deployer] = await ethers.getSigners()
			const otherUser = Wallet.createRandom()
			const beforeDeployerBalance = await example.balanceOf(deployer.address)
			expect(beforeDeployerBalance.toString()).to.equal('100' + BALANCE_SUFFIX)
			const beforeOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(beforeOtherUserBalance.toString()).to.equal('0')

			const iface = new ethers.utils.Interface([
				'function transfer(address to, uint256 amount)',
			])
			const functionData = iface.encodeFunctionData('transfer', [
				otherUser.address,
				'10' + BALANCE_SUFFIX,
			])
			await forwarder.execute(example.address, functionData, deployer.address)

			const afterDeployerBalance = await example.balanceOf(deployer.address)
			expect(afterDeployerBalance.toString()).to.equal('90' + BALANCE_SUFFIX)
			const afterOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(afterOtherUserBalance.toString()).to.equal('10' + BALANCE_SUFFIX)
		})
	})

	describe('transferFrom', () => {
		it('trasnfer token', async () => {
			const [deployer, relayerContract] = await ethers.getSigners()
			await example.approve(relayerContract.address, '10' + BALANCE_SUFFIX)
			const otherUser = Wallet.createRandom()
			const beforeDeployerBalance = await example.balanceOf(deployer.address)
			expect(beforeDeployerBalance.toString()).to.equal('100' + BALANCE_SUFFIX)
			const beforeOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(beforeOtherUserBalance.toString()).to.equal('0')

			await example
				.connect(relayerContract)
				.transferFrom(
					deployer.address,
					otherUser.address,
					'10' + BALANCE_SUFFIX
				)

			const afterDeployerBalance = await example.balanceOf(deployer.address)
			expect(afterDeployerBalance.toString()).to.equal('90' + BALANCE_SUFFIX)
			const afterOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(afterOtherUserBalance.toString()).to.equal('10' + BALANCE_SUFFIX)
		})
		it('trasnfer token by forwader', async () => {
			const [deployer, relayerContract] = await ethers.getSigners()
			await example.approve(relayerContract.address, '10' + BALANCE_SUFFIX)
			const otherUser = Wallet.createRandom()
			const beforeDeployerBalance = await example.balanceOf(deployer.address)
			expect(beforeDeployerBalance.toString()).to.equal('100' + BALANCE_SUFFIX)
			const beforeOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(beforeOtherUserBalance.toString()).to.equal('0')

			const iface = new ethers.utils.Interface([
				'function transferFrom(address from, address to, uint256 amount)',
			])
			const functionData = iface.encodeFunctionData('transferFrom', [
				deployer.address,
				otherUser.address,
				'10' + BALANCE_SUFFIX,
			])
			await forwarder.execute(
				example.address,
				functionData,
				relayerContract.address
			)

			const afterDeployerBalance = await example.balanceOf(deployer.address)
			expect(afterDeployerBalance.toString()).to.equal('90' + BALANCE_SUFFIX)
			const afterOtherUserBalance = await example.balanceOf(otherUser.address)
			expect(afterOtherUserBalance.toString()).to.equal('10' + BALANCE_SUFFIX)
		})
	})
	describe('msg data', () => {
		it('msg data', async () => {
			const [deployer] = await ethers.getSigners()
			const data = await example.getMsgData()
			const iface = new ethers.utils.Interface([
				'function saveCurrentMsgData()',
			])
			const functionData = iface.encodeFunctionData('saveCurrentMsgData', [])

			await forwarder.execute(example.address, functionData, deployer.address)
			const data2 = await example.currentData()
			expect(data).to.not.equal(data2)
		})
	})
})
