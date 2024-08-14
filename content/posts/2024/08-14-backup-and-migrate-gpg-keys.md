+++
title = 'How I backup and migrate my GPG keys'
date = 2024-08-14T00:27:52+02:00
draft = false
toc = true
tags = ['gpg', 'security']
+++

Have you ever heard about GPG (or GnuPG)? Yes? Gooood :3 No? Give it a quick search and check it out, it can be some nerd fun.

Creating GPG keys is [one easy story](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key). 
Keeping them is a whole other! Since I'm one of these people who always forgets the simplest things and therefore has to look them up,
I decided to write this quick article about how to move your GPG keys from one machine to another...or creating a backup of them in general.

## How do I find my keys?
To be able to migrate and backup your key(s), we need to export them from the machines key store first.

Let's check for the ID of the key we want to export first with:
```shell
gpg --list-secret-keys --keyid-format LONG
```
Running this command will give us something like this (depending on how many keys you have in your store)
```shell
sec   ed25519/XXXXXXXXXXXXXX 2023-08-14 [SC] [expires: 2026-08-14]
      B899892A9D13D8A761B5F3E0E3DC722E2943A517
uid                 [ultimate] Alex Ottr <alex@otter.foo>

```
Some hard nerds might recognise this key, it's mine. The first line shows the used **GPG key algorithm**, followed by the **key ID**.
Those two dates define the **creation** and **expiration date** of the key.

The second line shows the fingerprint of my key `B899892A9D13D8A761B5F3E0E3DC722E2943A517`. If you see this key somewhere, this message / identity usually (hopefully) belongs to me.
The last line represents the user identity, in my case my pseudo and mail address.

## How do I export my keys?
Our GPG key is actually a keypair. This means, that we will have to export the public and secret part.

Let's start with the **public key**:
```shell
gpg --export -a <key-ID> > gpg-pub.asc
```
This command, when entering the right key ID that we just saw above, will export the public key from the keystore into a text-file.

***Hint:*** You can also use your mail address instead of the key-ID. If you use the same mail address for different keys, multiple will be exported.

Continuing with the **private key**:
```shell
gpg --export-secret-keys -a <key-ID> > gpg-sec.asc
```

We successfully exported our GPG keypair. If you plan on creating a backup of them, please don't upload them anywhere. Especially **not the private key**! 
Even if your private key has a passphrase, just don't. I keep mine on a small USB-Stick that I regularly reconnect with my PC and keep at a secure place.
You can even tar them in an encrypted archive if you want (example in appendix).

## How do I import my keys again?
After safely transferring the files to your new machine, via an usb-stick, local file-share etc., we need to import our keys again into gnupg.
```shell
gpg --import gpg-pub.asc
gpg --import gpg-sec.asc
```

Doing so, will import the keypair into the local GPG keystore of our new machine, running the list-command from above again should show us the following:
```shell
sec   ed25519/XXXXXXXXXXXXXX 2023-08-14 [SC] [expires: 2026-08-14]
      B899892A9D13D8A761B5F3E0E3DC722E2943A517
uid                 [unknown] Alex Ottr <alex@otter.foo>

```
But wait! Why does it say `unknown` now since before, before it said `ultimate`?
This is just the level of trust we give this key. We can fix that easily!

## Trusting our migrated GPG-keys
Back on the old machine, we simply export the trust levels given with:
```shell
gpg --export-ownertrust > trust.txt
```
Now we send the file to the new machine and run:
```shell
gpg --import-ownertrust trust.txt
```
and done. We trust our keypair again with the ultimate trust!

***But I don't have access to my old machine anymore after I exported the keys?!***
**No problem!** This can also be solved in a different way.

For this we need to edit the key after we migrated it. GnuPG does not only store your key, the CLI gives some handy tools when editing it. I will cover parts of that in another article soon.
```shell
gpg --edit-key <key-ID>
```
We get greeted by the prompt `gpg>` and enter the command `trust`.
Now we get asked on the level of trust we want to give the key (or the user historically)
```
Please decide how far you trust this user to correctly verify other users' keys
(by looking at passports, checking fingerprints from different sources, etc.)

  1 = I don't know or won't say
  2 = I do NOT trust
  3 = I trust marginally
  4 = I trust fully
  5 = I trust ultimately
  m = back to the main menu

Your decision? 5
```
We want to give the ultimate trust, since it's our own key. Therefore, we enter `5`.
Followed by the `save` command, we successfully migrated our GPG keys!

## Appendix
*Some* extra stuff.

### Creating an encrypted backup
One could argue: *"Let's use GPG to encrypt our key-file, isn't that what we use GPG for?"*
Although we *could* encrypt the key-file with a different GPG key, it wouldn't solve our issue and more create a chicken-and-egg problem instead.

Let's start with the simplest method: a **password protected zip-file**.
```shell
zip -P super-secret-password keys.zip gpg-* trust.txt
```
This command compresses our GPG private- and public key and the trust file into a password protected zip-file. If we want to access these files, we'll have to enter the set password after the `-P` parameter: `super-secret-password`

Better than nothing, but let's go a step further: an **AES-256 encrypted tar-file**.
```shell
tar -czf - gpg-* trust.txt | openssl enc -e -aes256 -pbkdf2 -iter 100000 -out keys.tar.gz
```
We now compress our files into a tar gz archive and then encrypt it with `AES-256-CBC`, [PBKDF2](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) and a chosen password (with `100000` iterations on the password). Needless to say to use a password manager to remember a very secure password if you want to go this route.

If we want to decrypt this boy, we basically just reverse the steps, using the same parameters for the decryption:
```shell
 openssl enc -d -aes256 -pbkdf2 -iter 100000 -in keys.tar.gz | tar xz -C .
```
This will decrypt and decompress all files into the current directory.

I could go deeper into this topic of encryption with tools like [age](https://github.com/FiloSottile/age), I still wouldn't upload my keys publicly :3

Thanks for reading !