![Logo](admin/EnOcean.png)
# ioBroker.enocean
![Number of Installations](http://iobroker.live/badges/enocean-installed.svg) ![Number of Installations](http://iobroker.live/badges/enocean-stable.svg) 


=================


Tested with USB 300 Gateway https://www.enocean.com/de/enocean_module/usb-300-oem/

At this time the Adapter can only recive states.

## Changelog

### 0.3.0
* Added Autodetect for UTE (Unidirectional) Teach-in
*  Added Autodetect for Rocker Switches
*  Added full readonly support for PSC234
*  Added Multi-EEP support
*  Removed no longer used Objects from info

### 0.2.0
* Added Autodetect of devices (4BS Telegrams / A5 EEP's)
*  Added manufacturer_list.js and fit devices.json
*  Fix EEP A5-02-05

### 0.1.3
* (Schluesselmeister) Added support for Admin v3
* (Schluesselmeister) Added additional Languages
* (Schluesselmeister) Add basic manufacturer/device list to automatically select EEP/desc.
* (Schluesselmeister) Added tests for nodejs version 4 and 6 again
* (Schluesselmeister) Changed EEP/desc field to drop down lists.
* (Schluesselmeister) Added F6-02-02, F6-02-03, A5-02-05 without testing. 

#### 0.1.2
* (Schluesselmeister) Added device managment to adapter config
* (Schluesselmeister) Added support for new devices: smoke detector (Eltako FRW), F6-10-00 (Hoppe window handle), EEP D5-00-01 (door/window contact)

#### 0.1.1
* (AlCalzone) changed teach-in mode
* (AlCalzone) add forget mode
* (Jey Cee) add DropDown for Serialport choose, works on Windows and Linux

#### 0.1.0
* (Jey Cee) Alpha release 

#### 0.0.1
* (Jey Cee) initial release

## License
The MIT License (MIT)

Copyright (c) 2017 Jey Cee <jey-cee@live.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
