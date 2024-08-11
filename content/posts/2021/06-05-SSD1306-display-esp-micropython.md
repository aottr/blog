+++
title = 'Drawing content on SSD1306 displays with ESP and micropython'
date = 2021-06-05T17:14:26+02:00
draft = false
tags = ['hardware', 'SSD1306', 'ESP8266', 'micropython']
+++

> ***Disclaimer:*** This article has been imported from Ko-Fi with limited syntax highlighting capabilities and might be updated in the future to better showcase the code.

Designing IoT devices always brings the aspect of costs per device / per system with it. The **SSD1306** OLED display and the **ESP8266** or **ESP32** microcontroller are relatively cheap parts but also highly available and powerful. While Arduino was and still is the go-to platform for many people, especially beginners, ESPs tempt with their **built-in WiFi** and the possibility to program them with **MicroPython**. Making them perfect for IoT application, prototyping and other use-cases.

{{<figure src="https://storage.ko-fi.com/cdn/useruploads/display/bce49277-59e9-4671-a980-75a3767d60e5_img_2335.jpeg" title="Test setup with an ESP32">}}

A couple months ago a friend of mine requested an easily adaptable way to display different kinds of content on a roughly 1" *SSD1306 OLED display* to provide a user interface for configuring and runtime output of a photography tool.

There are libraries for that purpose to draw simple text and shapes on that display, the main code tends to clutter very fast if there isn't some kind of wrapper around the display content generation. He also requested to be able to control a menu navigation with buttons and / or a rotary encoder.


After I agreed to take a look at it we both take a weekend off to tinker about it. It was that weekend I wrote the Syna framework. This shouldn't be any kind of advertisement, the code is licensed under MIT and free to use / modify :D I just want to give a little introduction in how to use it properly and maybe it will help you with your next project. 


At first I thought about what the main functionality of a user interface should be...
- **show** (to actually display the content)
- **up** and **down** (for navigating by turning e.g. a rotary encoder)
- **click** (as some kind of ENTER or confirmation)

After those functions I wrote an Interface that all upcoming views should inherit from to provide the same basic functionality, no matter whats behind. This way the enduser can just call those functions and expect it to work while the functionality itself "how it works" is implemented by the individual view.

```py
class SynaInterface:
    ...
    def show(self):
        pass

    def up(self):
        pass

    def down(self):
        pass

    def click(self):
        pass
```

There is something missing, right, the `__init__` which expects a `ssd1306` object, already set up with the resolution and type of connection, and also a possible parent view in case of a cascading menu structure. Some *SSD1306* displays also have a yellow headline, so there is another parameter to set a text there. [Ref. Line 16-38](https://github.com/Lipurd/syna/blob/main/syna.py)

This interface can now be inherited to create custom view classes that can be called by the wrapper class. There are some examples for that in other projects if the menu view is to complex, just ask in the comments about it and I'll like at least one :3

***Wrapper class ?*** Yes ! The whole purpose of this project was to move as much complexity as possible to a wrapper and handle UI calls in an abstract manner.

The wrapper class is called `Syna` and is also inheriting from the `SynaInterface` class. [Ref. Line 40-79](https://github.com/Lipurd/syna/blob/main/syna.py) Since menus are essential most applications, the Framework ships with an already prepared Menu view that can be added via the first Method after the classes constructor. Expecting an unique `identifier` (to invoke it later on from the application) a list of `items` and a `headline` / `parent` if needed, the `addMenu` method lets you add...a menu ! Functionality will be explained later.

The next method `addView` is more abstract while doing very similar work. In fact, it will do exactly the same if you assign an already prepared `Menu` object to the `view` parameter. The `addMenu` method is basically just creating the `Menu` object for you with the given menu items.

As mentioned before, any class inheriting the `SynaInterface` can be  assigned as a `view` and will be called if set to active, passing the user inputs.

***Setting active ?*** The `show` method expects the prior mentioned `identifier` to display the requested view on the display (or call the show method of the requested view to be more precise). Analog to that the inherited `up` and `down` methods pass their call to the currently active view.

The click method has a little bit more functionality and checks if the currently active view is a Menu. If so, it adds the functionality to check for to-be-opened views, marked with the prefix `@` and opens the view. This functionality is actually highly integrated and might not be for everyone, at least in the use-cases I looked at so far, it made many things very easy + the Menu itself has other functionality to react to the `click`. 

The Menu class is actually somewhat hard to explain and I'd like to avoid it here. I can give a deeper look if requested. It basically provides a menu structure with pagination, auto-scaling menu items, unlimited scrolling etc. It lets you add either callables via the python `eval()` function or sub-views including sub-menus to create a varied UI.

I also added an [example configuration](https://github.com/Lipurd/syna/blob/main/example.py) to the repo that expects an *SSD1306* display connected via *I2C*.

It shows the setup of a very...very simple main menu (L. 12)
```py
menu = syna.Syna(oled)
menu.addMenu('main', items, 'Main menu')
menu.addMenu('sub1', [['%10s' % 'Start', 'print("test")'], 'Test 100'], 'Submenu 1', 'main')
menu.show('main')
```

The prior created *ssd1306* object `oled` is required for creating a wrapper instance. After creation menus (or views) can be added by either using predefined variables or inline (as in the menu `sub1`) which is also passing the command `print('test')` as a list item. That's one example of the callable mentioned earlier and runs the print-command from the context of the main application. The same line also shows the last parameter `main`, the unique identifier of the Main menu, making this to a real sub menu.

With the last line `menu.show('main')` the configured view with the identifier 'main' will be displayed.

Since there are no buttons etc. attached to that example user behaviour has to be simulated by calling the methods `up`, `down` and `click` manually with a set delay. As you can see there is no need to go into the separate views since everything gets handled by the wrapper and the views, keeping track of the current "cursor position" and acting accordingly. 

Here is an example of a [custom view](https://github.com/Lipurd/timasledi/blob/main/modules/setup_view.py) I created for another project. It inherits and extends the `SynaInterface` to display a setup menu with auto-changing values etc. 

It's fun to work with and could be a reference / inspiration for other programmers, doesn't matter if beginner or experienced.