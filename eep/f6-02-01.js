
module.exports=function(data) {
  var retValue = {};

  var data = telegram['data'];

  // check, if it is the keep alive message

//    return {'rawbyte' : telegram['rawByte'][24]};

  if (telegram['rawByte'][24] == '2') { // T21 and NU
      // TODO: to be implemented

  } else {
      // message
       var SA = (data['SA'].value == 1);
       var EB = (data['EB'].value == 1);
       var R1 = data['R1'].value;
       var R2 = data['R2'].value;

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
                     retValue['R2_AI'] = EB;
                     break;
                 case 1:
                     retValue['R2_AO'] = EB;
                     break;
                 case 2:
                     retValue['R2_BI'] = EB;
                     break;
                 case 3:
                     retValue['R2_BO'] = EB;
                     break;
             }
        }
  }
  return retValue;
}
