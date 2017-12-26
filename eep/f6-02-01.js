
module.exports=function(data) {
  var retValue = {};

  var data = telegram['data'];

  // check, if it is the keep alive message

//    return {'rawbyte' : telegram['rawByte'][24]};

  if (telegram['rawByte'][12] == '2') { // T21 and NU
      // TODO: to be implemented

  } else {
      // message
      var dataField = parseInt(telegram.slice(2,4), 16);
      var SA =  dataField & 0x01;
      var R1 = (dataField & 0xE0) >> 5;
      var R2 = (dataField & 0x0E) >> 1;
      var EB = ((dataField & 0x10) == 0x10);

       switch(R1) {
              case 0:
                  retValue = {R1_AI: EB};
                  break;
              case 1:
                  retValue = {R1_AO: EB};
                  break;
              case 2:
                  retValue = {R1_BI: EB};
                  break;
              case 3:
                  retValue = {R1_BO: EB};
                  break;
        }

        if (SA) {
            switch(R2) {
                 case 0:
                     retValue['R1_AI'] = EB;
                     break;
                 case 1:
                     retValue['R1_AO'] = EB;
                     break;
                 case 2:
                     retValue['R1_BI'] = EB;
                     break;
                 case 3:
                     retValue['R1_BO'] = EB;
                     break;
             }
        }
  }
  return retValue;
}
