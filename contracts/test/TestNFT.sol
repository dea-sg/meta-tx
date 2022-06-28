// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "../metatx/MetaTxContextUpgradeable.sol";

contract TestNFT is
	ERC721Upgradeable,
	MetaTxContextUpgradeable,
	AccessControlEnumerableUpgradeable
{
	bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");

	function initialize(address _forwarderAccessControl) public initializer {
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
		__ERC721_init("token", "TOKEN");
		__MetaTxContext_init(_forwarderAccessControl);
		__AccessControlEnumerable_init();
	}

	function mint(address to, uint256 tokenId) external onlyRole(MINT_ROLE) {
		_mint(to, tokenId);
	}

	function _msgSender()
		internal
		view
		override(ContextUpgradeable, MetaTxContextUpgradeable)
		returns (address sender)
	{
		return MetaTxContextUpgradeable._msgSender();
	}

	function _msgData()
		internal
		view
		override(ContextUpgradeable, MetaTxContextUpgradeable)
		returns (bytes memory)
	{
		return MetaTxContextUpgradeable._msgData();
	}

	function supportsInterface(bytes4 interfaceId)
		public
		view
		override(ERC721Upgradeable, AccessControlEnumerableUpgradeable)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}
}
