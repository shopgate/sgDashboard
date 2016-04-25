sgDashboard
=========================

##Available Interfaces
- [Jira](https://www.atlassian.com/software/jira)
- [Zendesk](https://www.zendesk.com/)
- [Inopla](https://www.inopla.de/)

##Requirements
This project uses the following dependences:
- NodeJS
- Typescript
- MongoDB
- Redis


##How to install

The easiest way to get started is to clone the repository:

```bash
$ git clone git@github.com:shopgate/sgDashboard.git
$ cd sgDashboard
```
---
sgDashboard is completely written in [Typescript](http://www.typescriptlang.org/).
So we need to install Typescript first and transpile the code before we are able to run it
```bash
$ sudo npm install -g typescript
$ tsc 
```

##How to configure

Just copy the `config.default.json` to `config.json` and edit it:
```bash
$ cp config/default.json config/local.json
$ vi config/local.json
```










