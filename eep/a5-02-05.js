module.exports = function (telegram) {
    "use strict";

    // message
    var retValue = {};
    var dataField = parseInt(telegram.slice(2, 10), 16);
    var lb =  (dataField & 0x00000008) >> 3;
    var value = (dataField & 0x0000FF00) >> 8;

    retValue['learn_button'] = (lb === 1);
    if (1 === lb) {
      retValue['temperature'] = Math.trunc((value * 40 / 255 + 0.05) * 10) / 10 ;
    }

    return retValue;
}
