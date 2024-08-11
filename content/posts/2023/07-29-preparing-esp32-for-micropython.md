+++
title = 'Preparing the ESP32 for MicroPython'
date = 2023-07-29T21:30:42+02:00
draft = false
tags = ['python', 'hardware']
images = ['https://i.imgur.com/PZHFKEY.jpg']
toc = true
+++

About 2 years ago, [I wrote a small library](/posts/2021/06-05-ssd1306-display-esp-micropython/) to create menus on an *ESP8266/32* utilising the *SSD1306* OLED Display and MicroPython.

[MicroPython](https://micropython.org/) is a stripped down variant of Python, basically made for IoT devices. A very well known example of such device-series is the Arduino Family or ESPs.

## Installing the USB-Serial driver
There are two common chips on ESPs: `CP210x` or `CH340x`. Those chips can be found close to the USB-Connector on the ESP-Board.

{{<figure src="https://i.imgur.com/PZHFKEY.jpg" title="Find the right chip version for your ESP">}}

As shown on the picture above my board uses the `CH340C` USB to UART bridge. Drivers can be found on different pages and highly depend on the platform and chip. I got mine from this page https://sparks.gogo.co.nz/ch340.html, more specifically the linked [GitHub Repository](https://github.com/adrianmihalko/ch340g-ch34g-ch34x-mac-os-x-driver). A high number of Stars and signed drivers / a Brew repository are a good indication for a valid source (but no guarantee !)

## Getting the right Firmware
After successfully installing the driver I needed to find the right firmware for my specific ESP board model. To run MicroPython an a device, it needs the firmware to be installed on the flash first. MicroPython offers a huge selection of firmware-versions on their [Download Page](https://micropython.org/download/#esp32). If your specific version is not shown on the filtered list, a very close version should be enough for it to work.

I personally used a *lolin32 v.1.0* for my initial testings and the basic *Espressif ESP32* binary worked just fine.

## Flashing the Firmware on the ESP

There are a few different ways to flash a new firmware on an ESP. My personal favourite is the [Espressif esptool.py](https://github.com/espressif/esptool/) which can be downloaded directly or installed via pip.

{{<figure src="https://i.imgur.com/oRQ3rTw.png">}}

The command shown in the screenshot above deletes all the existing flash contents of the ESP. The --port argument describes the physical connection to the ESP, in my case it was called `/dev/tty.usbserial-14220`.

The tool also shows the version of my ESP-board: `ESP32-D0WDQ6`, and the installed features.

The next command will upload the earlier downloaded firmware to the devices flash storage.

{{<figure src="https://i.imgur.com/U9zloSr.png">}}

This command looks very similar to the command earlier, the difference is the action we process on the device `write_flash` with the argument `-z` followed by the start address `0x1000` and the path to the binary.

We can now test the set up board by establishing a serial connection via a terminal emulator like [picocom](https://github.com/npat-efault/picocom) to the device.

{{<figure src="https://i.imgur.com/kaqmmKI.png">}}

We can now run *MicroPython* code on our ESP device. Next step will be the actual planning of the Project :3

This article is a bit less deep than intended. Reason for this is the wide variety of combinations that can be used. If you have any in-depth questions don't hesitate to contact me ! :3