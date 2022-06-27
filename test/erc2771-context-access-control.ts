/* eslint-disable new-cap */
import { expect, use } from 'chai'
import { ethers } from 'hardhat'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { makeSnapshot, resetChain } from './utils'
import { MinimalERC2771ContextAccessControlUpgradeable } from '../typechain-types'

use(solidity)

describe('MinimalERC2771ContextAccessControlUpgradeable', () => {
	let minimal: MinimalERC2771ContextAccessControlUpgradeable
	let snapshot: string
	before(async () => {
		const factory = await ethers.getContractFactory(
			'MinimalERC2771ContextAccessControlUpgradeable'
		)
		minimal =
			(await factory.deploy()) as MinimalERC2771ContextAccessControlUpgradeable
		await minimal.deployed()
		await minimal.initialize()
	})
	beforeEach(async () => {
		snapshot = await makeSnapshot()
	})
	afterEach(async () => {
		await resetChain(snapshot)
	})
	describe('admin role', () => {
		it('deployer has admin role', async () => {
			const [deployer] = await ethers.getSigners()
			const adminRole = await minimal.DEFAULT_ADMIN_ROLE()
			const hasRole = await minimal.hasRole(adminRole, deployer.address)
			expect(hasRole).to.equal(true)
		})
		it('not deployer has not admin role', async () => {
			const [, otherSigner] = await ethers.getSigners()
			const adminRole = await minimal.DEFAULT_ADMIN_ROLE()
			const hasRole = await minimal.hasRole(adminRole, otherSigner.address)
			expect(hasRole).to.equal(false)
		})
	})
	describe('forwarder role', () => {
		it('no one has not forwarder role', async () => {
			const foo = Wallet.createRandom()
			const forwarderRole = await minimal.FORWARDER_ROLE()
			const hasRole = await minimal.hasRole(forwarderRole, foo.address)
			expect(hasRole).to.equal(false)
		})
		it('set forwarder role', async () => {
			const foo = Wallet.createRandom()
			const forwarderRole = await minimal.FORWARDER_ROLE()
			await minimal.grantRole(forwarderRole, foo.address)
			const hasRole = await minimal.hasRole(forwarderRole, foo.address)
			expect(hasRole).to.equal(true)
		})
	})
})
