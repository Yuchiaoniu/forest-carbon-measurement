// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GroundTruth {
    address public owner;
    uint256 public recordCount;

    struct Record {
        bytes32 videoHash;
        uint32 manualTapeDbhMm;
        uint256 timestamp;
    }

    mapping(uint256 => Record) public records;

    event GroundTruthRecorded(
        uint256 indexed id,
        bytes32 indexed videoHash,
        uint32 manualTapeDbhMm,
        uint256 timestamp
    );

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    constructor() { owner = msg.sender; }

    function recordGroundTruth(bytes32 videoHash, uint32 manualTapeDbhMm)
        external onlyOwner returns (uint256)
    {
        uint256 id = ++recordCount;
        records[id] = Record(videoHash, manualTapeDbhMm, block.timestamp);
        emit GroundTruthRecorded(id, videoHash, manualTapeDbhMm, block.timestamp);
        return id;
    }
}
