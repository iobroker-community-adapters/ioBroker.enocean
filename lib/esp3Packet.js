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
		this.dataLength 	= rawData.readUInt16BE(1);
		this.optionalLength = rawData[3];

		this.type 			= rawData[4];

		this.data 			= rawData.slice(6, 6 + this.dataLength);
		this.optionalData 	= rawData.slice(6 + this.dataLength, 6 + this.dataLength + this.optionalLength);
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
		this.userData = packet.data.slice(1, -5);

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

/**
 * Represents a packet with type = 2
 */
class ResponseTelegram {
    /**
     * @param {ESP3Packet} packet
     */
    constructor(packet) {
        /**
         * Data length
         */
        this.dataLength = packet.dataLength;

        /**
         * Optional length
         */
        this.optionalLength = packet.optionalLength;

        /**
         * Return the data
         */
        this.data = packet.data ;

    }
}

/**
 * Represents a teach-in packet 1BS
 */
class OneBSTeachIn {

    /**
     * @param {Data} packet
     */
    constructor(packet) {

        /**
         * Actual user data in this packet
         */
        this.userData 	= 	packet.toString("hex");
        this.teachIn 	= 	(packet[0] & 0x00000008) >> 3;

    }
}

/**
 * Represents a teach-in packet 4BS
 */
class FourBSTeachIn {

    /**
     * @param {Data} packet
     */
    constructor(packet) {

        /**
         * Actual user data in this packet
         */
        this.userData 	= 	packet.toString("hex");
        this.teachIn 	= 	(packet[3] & 0x00000008) >> 3;
        this.LRNtype 	= 	(packet[3]) >> 7;
        this.EEPFunc 	= 	packet[0] >> 2;
        this.EEPType 	= 	((packet[0] & 0x3) + (packet[1] & 0xF8)) >>3;
        this.mfrID		= 	((packet[1] & 0x7) + packet[2]);

    }
}

/**
 * Represents a teach-in packet UTE
 */
class UTETeachIn {

    /**
     * @param {Data} packet
     */
    constructor(packet) {

        /**
         * Actual user data in this packet
         */
        this.userData 	= packet.toString("hex");
        this.com		= (packet[0] & 0x80) >> 7;
        this.response	= (packet[0] & 0x40) >> 6;
        this.request	= (packet[0] & 0x30) >> 4;
        this.cmd		= (packet[0] & 0xF);
        this.channels	= packet[1];
        this.EEPRorg	= packet[6];
        this.EEPFunc 	= packet[5];
        this.EEPType 	= packet[4];
        this.IDLSB		= packet[2];
        this.IDMSB		= (packet[3]& 0x7);

    }
}

module.exports = {
	ESP3Packet: ESP3Packet,
	RadioTelegram: RadioTelegram,
	ResponseTelegram: ResponseTelegram,
	FourBSTeachIn: FourBSTeachIn,
	UTETeachIn: UTETeachIn,
};