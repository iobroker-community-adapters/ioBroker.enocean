
module.exports=function(telegram) {
    var retValue = {};

    if (telegram[12] == '2') { // T21 and NU
        // keep alive
        retValue = {keep_alive : true, alarm: false, battery_status: true};
    } else {
        // message
        var dataField = parseInt(telegram.slice(2,4), 16);
        var SA =  dataField & 0x01;
        var R1 = (dataField & 0xE0) >> 5;
        var EB = ((dataField & 0x10) == 0x10);

        switch(R1) {
            case 0:
                if (!EB) {
                    retValue = {alarm: false, keep_alive : true};
                } else {
                    retValue = {alarm: true, keep_alive : true};
                }
                break;
            case 1:
                if (EB) {
                    retValue = {battery_status: false, keep_alive : true};
                }
                break;
            case 2:
                break;
            case 3:
                break;
        }
    }
    return retValue;
}
