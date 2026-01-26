+++
title = 'Prettying up my terminal with ZSH and oh-my-posh'
date = 2026-01-25T15:33:18+02:00
draft = true
toc = true
tags = ['zsh', 'oh-my-posh', 'terminal', 'dotfiles']

tldr = 'Setting up ZSH and oh-my-posh to make my terminal look better and easier to work with.'
+++

After many years of using zsh with [powerlevel10k](https://github.com/romkatv/powerlevel10k), switching to [fish](https://fishshell.com/) and then falling back to the default terminal, I've decided to try something new and more up-to-date...
I've been using the default terminal for a long time now. It's simple, it's easy to use, and it's what the system comes with. I've been wanting to try something new for a while now, but the lack of time kept me from doing so (as always).

Things like the quite restricted default `CTRL+R` history search, bland colors, ugly prompts etc. motivated me to give it another try.

## Setting up ZSH

First, I needed to install ZSH. I've been using Ubuntu for my dev machines recently, since I'm required to use it at work and I got frustrated at NixOS too many times (which is a whole other story. Hint: PrismaORM).

```bash
sudo apt install zsh
chsh -s $(which zsh) # Change the default shell to zsh
```

Of course, depending on your distribution, the package manager might be different. On MacOS, zsh should be already installed (but you might want to update it with brew).

## Installing oh-my-posh

Next, we need to install [oh-my-posh](https://ohmypo.sh/docs/installation/linux). 

```bash
curl -s https://ohmyposh.dev/install.sh | bash -s
```

This should install oh-my-posh into `~/.local/bin/`, depending on your environment.
Now, we need to add the following to our `.zshrc` file:

```bash
eval "$(oh-my-posh init zsh)"
```

### Motivating for using oh-my-posh

1. Apparently, powerlevel10k is not [maintained anymore](https://github.com/romkatv/powerlevel10k/blob/b97926675aba2d8465325d786cc69de9d9fdec84/README.md) (in terms of new features) and the support / help requests are not answered. 
2. Many people are reporting issues with Oh My ZSH and its performance.
3. Starship is fast, "Rust-Powered" but does a bit too much "magic" for my taste.

### Configuring oh-my-posh

Now, we need to configure oh-my-posh. The default configuration is embedded and we'd need to pass it to the `oh-my-posh init` command. To do so, we can start with the default configuration and modify it as needed.

```bash
oh-my-posh config export --format toml --output ~/.config/oh-my-posh/config.toml
```
Alternatively to `.toml`, we can also export the configuration to `.yaml` if wanted.

To load the configuration, we need to update the init command in our `.zshrc` file:

```bash
eval "$(oh-my-posh init zsh --config ~/.config/oh-my-posh/config.toml)"
```

The promt structure in oh-my-posh is separated into so called "segments". Their [documentation](https://ohmypo.sh/docs/segments/system/status) gives a good overview of the available segments and how to configure them.

Alternaively, they also provide a long list of [themes](https://ohmypo.sh/docs/themes) to choose from, including [powerlevel10k_lean](https://github.com/JanDeDobbeleer/oh-my-posh/blob/main/themes/powerlevel10k_lean.omp.json) and [pure](https://github.com/JanDeDobbeleer/oh-my-posh/blob/main/themes/pure.omp.json), which are quite similar to the one I was using back then.

I decided to write my own theme, inspired by the [powerlevel10k_lean](https://github.com/JanDeDobbeleer/oh-my-posh/blob/main/themes/powerlevel10k_lean.omp.json) theme and the [video by Dreams of Autonomy](https://www.youtube.com/watch?v=9U8LCjuQzdc) 

```toml
# transient prompt is how are past prompts are displayed
[transient_prompt]
  template = '❯ '
  foreground = 'magenta'
  foreground_templates = [
    '{{ if gt .Code 0 }}red{{ end }}',
  ]
  background = 'transparent'

# main prompt, separated into 2 lines with the path and the git status on top
[[blocks]]
  type = 'prompt'
  alignment = 'left'

  [[blocks.segments]]
    type = 'path'
    template = '{{ .Path }} '
    style = 'plain'
    foreground = 'blue'

    [blocks.segments.properties]
      style = 'full'
 
  [[blocks.segments]]
    type = 'git'
    template = '''{{ .HEAD }}{{ if or (.Working.Changed) (.Staging.Changed) }}*{{ 
    end }} <cyan>{{ if gt .Behind 0}}⇣{{ end }}{{ if gt .Ahead 0 }}⇡{{ end }}</>'''
    style = 'plain'
    foreground = '#6c6c6c'

    [blocks.segments.properties]
      branch_icon = ''
      commit_icon = '@'
      fetch_status = true

# active commandprompt on a new line
[[blocks]]
  type = 'prompt'
  alignment = 'left'
  newline = true

  [[blocks.segments]]
    type = 'text'
    template = '❯'
    style = 'plain'
    foreground = 'magenta'
    foreground_templates = [
      '{{ if gt .Code 0 }}red{{ end }}'
    ]

# right prompt with the execution time of the last command
[[blocks]]
  type = 'rprompt'
  overflow = 'hidden'

  [[blocks.segments]]
    type = 'executiontime'
    style = 'plain'
    foreground = 'yellow'
    template = '{{ .FormattedMs }}'

    [blocks.segments.properties]
      threashold = 2000
```

As seen by the last segment (executiontime), we can also add other segments to the prompt with different kinds of integrations (including nix btw). Those can be included in the prompt or in [Tooltips](https://ohmypo.sh/docs/configuration/tooltips), which are displayed during typing.

{{< callout emoji="⚡️" text="I did try to use some of the cli integrations to display the JavaScript package manager, but they were not working as expected. I might come back to this later as it does not select the type per lock-file." >}}

## Browsing the history with fzf

## Verdict

I'm quite happy with the result. It's not perfect (yet), but it's something to improve over time. I spend some time over the past few weeks to work-out a new tool-chain for docker deployments and the storage of my dotfiles after moving away from NixOS (for my dev machines !).

This is already a great start, the configs are stored on my GitHub and I'll follow-up with some more setups if this was interesting for you. ^^