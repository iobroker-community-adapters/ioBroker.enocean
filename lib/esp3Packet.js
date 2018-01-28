'use strict';

/**
 * Represents a packet received from the ESP3 serial interface
 */
class ESP3Packet {

	/**
	 * @param {Buffer} rawData The raw data to construct this packet from
	 */
	constructor(rawData) {

		// 2 bytes at position 1 => data length
		this.dataLength = rawData.readUInt16BE(1);
		this.optionalLength = rawData[3];

		this.type = rawData[4];

		this.data = rawData.slice(6, 6 + this.dataLength);
		this.optionalData = rawData.slice(6 + this.dataLength, 6 + this.dataLength + this.optionalLength);
	}

}

/**
 * Represents a packet with type = 1
 */
class RadioTelegram {

	/**
	 * @param {ESP3Packet} packet 
	 */
	constructor(packet) {
		/**
		 * Type of this packet (VLD, ADT, ...)
		 */
		this.type = packet.data[0];

		/**
		 * Actual user data in this packet
		 */
		this.userData = packet.data.slice(1, -5)

		/**
		 * Sender ID, e.g. AABBCCDD
		 */
		this.senderID = packet.data.slice(-5, -1).toString("hex");

		/**
		 * Status byte
		 */
		this.status = packet.data[packet.data.length - 1];

		this.rssi = packet.optionalData[5];
	}
}

module.exports = {
	ESP3Packet: ESP3Packet,
	RadioTelegram: RadioTelegram,
};