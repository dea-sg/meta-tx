/* eslint-disable new-cap */
import { expect, use } from 'chai'
import { ethers } from 'hardhat'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { makeSnapshot, resetChain } from './utils'
import {
	MinimalMetaTxContextUpgradeable,
	ForwarderAccessControlUpgradeable,
} from '../typechain-types'

use(solidity)

describe('MinimalMetaTxContextUpgradeable', () => {
	let minimal: MinimalMetaTxContextUpgradeable
	let control: ForwarderAccessControlUpgradeable
	let snapshot: string
	before(async () => {
		const controlFactory = await ethers.getContractFactory(
			'ForwarderAccessControlUpgradeable'
		)
		control =
			(await controlFactory.deploy()) as ForwarderAccessControlUpgradeable
		await control.deployed()
		await control.initialize()

		const minimalFactory = await ethers.getContractFactory(
			'MinimalMetaTxContextUpgradeable'
		)
		minimal = (await minimalFactory.deploy()) as MinimalMetaTxContextUpgradeable
		await minimal.deployed()
		await minimal.initialize(control.address)
	})
	beforeEach(async () => {
		snapshot = await makeSnapshot()
	})
	afterEach(async () => {
		await resetChain(snapshot)
	})
	describe('setForwarderAccessControl', () => {
		it('set address', async () => {
			expect(await minimal.forwarderAccessControl()).to.equal(control.address)
			const tmp = Wallet.createRandom()
			await minimal.setForwarderAccessControlTest(tmp.address)
			expect(await minimal.forwarderAccessControl()).to.equal(tmp.address)
		})
	})
	describe('isTrustedForwarder', () => {
		it('not have role', async () => {
			const uerWallet = Wallet.createRandom()
			const hasRole = await minimal.isTrustedForwarder(uerWallet.address)
			expect(hasRole).to.equal(false)
		})
		it('have role', async () => {
			const uerWallet = Wallet.createRandom()
			const role = await control.FORWARDER_ROLE()
			await control.grantRole(role, uerWallet.address)
			const hasRole = await minimal.isTrustedForwarder(uerWallet.address)
			expect(hasRole).to.equal(true)
		})
	})
})
