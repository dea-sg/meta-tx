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
	bytes32 public constant ITEM_ROLE = keccak256("ITEM_ROLE");
	address public forwarder;
	mapping(uint256 => uint256) public itemCounter;
	mapping(address => mapping(uint256 => uint256)) public itemIdMap;

	function initialize(address _forwarderAccessControl) public initializer {
		__MetaTxContext_init(_forwarderAccessControl);
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
		__ERC721_init("token", "TOKEN");
		__AccessControlEnumerable_init();
	}

	function mint(address to, uint256 tokenId) external onlyRole(MINT_ROLE) {
		_mint(to, tokenId);
	}

	function mintItem(address to, uint256 nonce) external {
		require(forwarder == msg.sender, "error!!!!!!");
		uint256 itemId = itemIdMap[to][nonce];
		uint256 count = itemCounter[itemId];
		uint256 tokenId = itemId * 1000 + count;
		_mint(to, tokenId);
		itemCounter[itemId] = count + 1;
	}

	function setForwarder(address _forwarder) external {
		forwarder = _forwarder;
	}

	function setKey(
		address to,
		uint256 nonce,
		uint256 itemId
	) external onlyRole(ITEM_ROLE) {
		itemIdMap[to][nonce] = itemId;
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
