/* eslint-disable new-cap */
import { expect, use } from 'chai'
import { ethers /* upgrades */ } from 'hardhat'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { makeSnapshot, resetChain } from './utils'
import { ForwarderAccessControlUpgradeable } from '../typechain-types'

use(solidity)

describe('ForwarderAccessControlUpgradeable', () => {
	let control: ForwarderAccessControlUpgradeable
	let snapshot: string
	before(async () => {
		const factory = await ethers.getContractFactory(
			'ForwarderAccessControlUpgradeable'
		)
		control = (await factory.deploy()) as ForwarderAccessControlUpgradeable
		await control.deployed()
		await control.initialize()
	})
	beforeEach(async () => {
		snapshot = await makeSnapshot()
	})
	afterEach(async () => {
		await resetChain(snapshot)
	})
	describe('initialize', () => {
		describe('success', () => {
			it('deployer has admin role', async () => {
				const [deployer] = await ethers.getSigners()
				const adminRole = await control.DEFAULT_ADMIN_ROLE()
				const hasRole = await control.hasRole(adminRole, deployer.address)
				expect(hasRole).to.equal(true)
			})
			it('not deployer has not admin role', async () => {
				const [, otherSigner] = await ethers.getSigners()
				const adminRole = await control.DEFAULT_ADMIN_ROLE()
				const hasRole = await control.hasRole(adminRole, otherSigner.address)
				expect(hasRole).to.equal(false)
			})
		})
		describe('fail', () => {
			it('Cannot be executed more than once', async () => {
				await expect(control.initialize()).to.be.revertedWith(
					'Initializable: contract is already initialized'
				)
			})
		})
	})
	describe('isTrustedForwarder', () => {
		it('no one has not forwarder role', async () => {
			const foo = Wallet.createRandom()
			const hasRole = await control.isTrustedForwarder(foo.address)
			expect(hasRole).to.equal(false)
		})
		it('set forwarder role', async () => {
			const foo = Wallet.createRandom()
			const forwarderRole = await control.FORWARDER_ROLE()
			await control.grantRole(forwarderRole, foo.address)
			const hasRole = await control.isTrustedForwarder(foo.address)
			expect(hasRole).to.equal(true)
		})
	})
})
