// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ResourceToken is ERC721, Ownable {

    uint256 public nextTokenId;

    uint256 public constant MAX_RESOURCES = 4;
    uint256 public constant COOLDOWN = 1 minutes;
    uint256 public constant LOCK_TIME = 1 minutes;

    struct Resource {
        string name;
        string resourceType;
        uint256 value;
        string ipfsHash;
        address[] previousOwners;
        uint256 createdAt;
        uint256 lastTransferAt;
    }

    event ResourceTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    mapping(uint256 => Resource) public resources;
    mapping(address => uint256) public resourceCount;
    mapping(address => uint256) public lastActionTime;

    constructor() ERC721("ResourceChain", "RSC") Ownable(msg.sender) {}

    // --- MODIFIERS ---
    modifier cooldownPassed(address user) {
        require(
            block.timestamp >= lastActionTime[user] + COOLDOWN,
            "Cooldown actif"
        );
        _;
    }

    // --- MINT ---
    function mintResource(
    address to,
    string memory name,
    string memory resourceType,
    uint256 value,
    string memory ipfsHash
)
    public
    onlyOwner
    cooldownPassed(msg.sender)
{
    require(resourceCount[to] < MAX_RESOURCES, "Limite atteinte");

    uint256 tokenId = nextTokenId;
    nextTokenId++;

    _safeMint(to, tokenId);

    Resource storage r = resources[tokenId];
    r.name = name;
    r.resourceType = resourceType;
    r.value = value;
    r.ipfsHash = ipfsHash;
    r.createdAt = block.timestamp;
    r.lastTransferAt = 0; 

    resourceCount[to]++;
    lastActionTime[to] = block.timestamp;
}


    // --- TRANSFER AVEC REGLES METIER ---
    function transferResource(address to, uint256 tokenId)
    public
{
    require(ownerOf(tokenId) == msg.sender, "Pas proprietaire");
    require(resourceCount[to] < MAX_RESOURCES, "Limite atteinte");
    require(
        block.timestamp >= resources[tokenId].lastTransferAt + LOCK_TIME,
        "Ressource verrouillee"
    );

    resources[tokenId].previousOwners.push(msg.sender);
    resources[tokenId].lastTransferAt = block.timestamp;

    resourceCount[msg.sender]--;
    resourceCount[to]++;

    lastActionTime[to] = block.timestamp; // optionnel

    _safeTransfer(msg.sender, to, tokenId, "");

    emit ResourceTransferred(tokenId, msg.sender, to, block.timestamp);
}

    function getPreviousOwners(uint256 tokenId)
        public
        view
        returns (address[] memory)
    {
        return resources[tokenId].previousOwners;
    }

    function getPreviousOwnersCount(uint256 tokenId)
        public
        view
        returns (uint256)
    {
        return resources[tokenId].previousOwners.length;
    }
}
