
module.exports=function(telegram) {
    var retValue = {};

    var data = telegram['data'];

    // check, if it is the keep alive message

//    return {'rawbyte' : telegram['rawByte'][24]};

    if (telegram['rawByte'][24] == '2') { // T21 and NU
        // keep alive
        retValue = {keep_alive : true, alarm: false, battery_status: true};
    } else {
        // message
        var SA = data['SA'].value;
        if ((SA == 0) && (data['R1'] != undefined)) {
            var R1 = data['R1'].value;
            var EB = (data['EB'].value == 1);

            switch(R1) {
                case 0:
                    if (EB) {
                        retValue = {alarm: false, keep_alive : true};
                    }
                    break;
                case 1:
                    if (EB) {
                        retValue = {alarm: true, keep_alive : true};
                    }
                    break;
                case 2:
                    break;
                case 3:
                    if (EB) {
                        retValue = {battery_status: false, keep_alive : true};
                    }
                    break;
            }
        } else {

        }

    }


    return retValue;
}
