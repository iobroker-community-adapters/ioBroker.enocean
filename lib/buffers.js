'use strict';

//
// Polyfills a couple of Buffer methods for NodeJS < 5.11
//

/**
 * Allocates an empty Buffer of the given size
 * @param {number} size The desired size of the Buffer
 * @returns {Buffer}
 */
function alloc(size) {
	if (typeof Buffer.alloc === "function") {
		return Buffer.alloc(size);
	} else {
		return new Buffer(size);
	}
}

/**
 * Creates a new Buffer from some source data
 * @param {ArrayBuffer | Buffer | Array} source The source data
 * @returns {Buffer}
 */
function from(source) {
	if (typeof Buffer.from === "function") {
		return Buffer.from(source)
	} else {
		return new Buffer(source);
	}
}

module.exports = {
	alloc: alloc,
	from: from,
};