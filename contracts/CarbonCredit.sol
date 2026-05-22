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
        uint256 localTreeId;           // SQLite trees.id，用於鏈下驗證比對
        uint32  originalDbhMm;         // 修正前原始估算值（0 表示未套用修正）
        uint32  correctionFactorX10000; // 修正因子 × 10000（10000 = 1.0000，0 = 未修正）
    }

    mapping(uint256 => Measurement) public measurements;
    uint256 public measurementCount;
    address public owner;

    event MeasurementRecorded(
        uint256 indexed id,
        string  gps,
        string  species,
        uint32  dbhMm,
        uint32  volumeCm3x100,
        uint32  carbonG,
        bytes32 videoHash,
        uint256 timestamp,
        uint256 localTreeId,
        uint32  originalDbhMm,
        uint32  correctionFactorX10000
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "CarbonCredit: not authorized");
        _;
    }

    constructor() { owner = msg.sender; }

    function recordMeasurement(
        string  calldata gps,
        string  calldata species,
        uint32  dbhMm,
        uint32  volumeCm3x100,
        uint32  carbonG,
        bytes32 videoHash,
        uint256 localTreeId,
        uint32  originalDbhMm,
        uint32  correctionFactorX10000
    ) external onlyOwner returns (uint256) {
        uint256 id = ++measurementCount;
        measurements[id] = Measurement(
            gps, species, dbhMm, volumeCm3x100, carbonG, videoHash,
            block.timestamp, localTreeId, originalDbhMm, correctionFactorX10000
        );
        emit MeasurementRecorded(
            id, gps, species, dbhMm, volumeCm3x100, carbonG, videoHash,
            block.timestamp, localTreeId, originalDbhMm, correctionFactorX10000
        );
        return id;
    }

    function getMeasurement(uint256 id) external view returns (Measurement memory) {
        return measurements[id];
    }
}
