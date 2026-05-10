// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CarbonCredit {
    struct Measurement {
        string  gps;
        string  species;
        uint32  dbhMm;
        uint32  volumeCm3x100;
        uint32  carbonG;
        bytes32 videoHash;
        uint256 timestamp;
    }

    mapping(uint256 => Measurement) public measurements;
    uint256 public measurementCount;
    address public owner;

    event MeasurementRecorded(
        uint256 indexed id,
        string  gps,
        string  species,
        uint32  dbhMm,
        uint32  carbonG,
        bytes32 videoHash,
        uint256 timestamp
    );

    constructor() { owner = msg.sender; }

    function recordMeasurement(
        string  calldata gps,
        string  calldata species,
        uint32  dbhMm,
        uint32  volumeCm3x100,
        uint32  carbonG,
        bytes32 videoHash
    ) external returns (uint256) {
        uint256 id = ++measurementCount;
        measurements[id] = Measurement(gps, species, dbhMm, volumeCm3x100, carbonG, videoHash, block.timestamp);
        emit MeasurementRecorded(id, gps, species, dbhMm, carbonG, videoHash, block.timestamp);
        return id;
    }

    function getMeasurement(uint256 id) external view returns (Measurement memory) {
        return measurements[id];
    }
}
