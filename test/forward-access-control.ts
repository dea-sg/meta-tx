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
	describe('admin role', () => {
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
	describe('forwarder role', () => {
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
	// Describe('update', () => {
	// 	it('update by deployer', async () => {
	//         const foo = Wallet.createRandom()
	//         const factory = await ethers.getContractFactory(
	//             'ForwarderAccessControlUpgradeable'
	//         )
	//         const factory2 = await ethers.getContractFactory(
	//             'ForwarderAccessControlUpgradeableTest'
	//         )
	//         const instance = await upgrades.deployProxy(factory, [], { kind: 'uups' })
	// 		const forwarderRole = await instance.FORWARDER_ROLE()
	// 		await instance.grantRole(forwarderRole, foo.address)
	//         const beforeHasRole = await instance.isTrustedForwarder(foo.address)
	//         expect(beforeHasRole).to.equal(true)

	//         const upgraded = await upgrades.upgradeProxy(instance.address, factory2)
	//         const afterHasRole = await upgraded.isTrustedForwarder(foo.address)
	//         expect(afterHasRole).to.equal(true)
	// 	})
	// })
})
