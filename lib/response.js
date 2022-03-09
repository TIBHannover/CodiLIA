'use strict'
// response
// external modules
const base64url = require('base64url')
const request = require('request')

// core
const config = require('./config')
const logger = require('./logger')
const models = require('./models')
const utils = require('./utils')
const history = require('./history')

// public
exports.responseError = responseError
exports.errorForbidden = errorForbidden
exports.errorNotFound = errorNotFound
exports.errorBadRequest = errorBadRequest
exports.errorTooLong = errorTooLong
exports.errorInternalError = errorInternalError
exports.errorServiceUnavailable = errorServiceUnavailable
exports.newNote = newNote
exports.newGitLabNote = newGitLabNote
exports.showPublishSlide = showPublishSlide
exports.publishNoteActions = publishNoteActions
exports.publishSlideActions = publishSlideActions
exports.githubActions = githubActions
exports.gitlabActions = gitlabActions
exports.checkViewPermission = checkViewPermission
exports.newCheckViewPermission = newCheckViewPermission
exports.responseCodiMD = responseCodiMD

function errorForbidden (req, res) {
  if (req.user) {
    responseError(res, '403', 'Forbidden', 'oh no.')
  } else {
    req.flash('error', 'You are not allowed to access this page. Maybe try logging in?')
    res.redirect(config.serverURL + '/')
  }
}

function errorNotFound (req, res) {
  responseError(res, '404', 'Not Found', 'oops.')
}

function errorBadRequest (req, res) {
  responseError(res, '400', 'Bad Request', 'something not right.')
}

function errorTooLong (req, res) {
  responseError(res, '413', 'Payload Too Large', 'Shorten your note!')
}

function errorInternalError (req, res) {
  responseError(res, '500', 'Internal Error', 'wtf.')
}

function errorServiceUnavailable (req, res) {
  res.status(503).send('I\'m busy right now, try again later.')
}

function responseError (res, code, detail, msg) {
  res.status(code).render('error.ejs', {
    title: code + ' ' + detail + ' ' + msg,
    code: code,
    detail: detail,
    msg: msg
  })
}

function responseCodiMD (res, note) {
  var body = note.content
  var extracted = models.Note.extractMeta(body)
  var meta = models.Note.parseMeta(extracted.meta)
  var title = models.Note.decodeTitle(note.title)
  title = models.Note.generateWebTitle(meta.title || title)
  res.set({
    'Cache-Control': 'private', // only cache by client
    'X-Robots-Tag': 'noindex, nofollow' // prevent crawling
  })
  res.render('codimd.ejs', {
    title: title
  })
}

function updateHistory (userId, note, document, time) {
  var noteId = note.alias ? note.alias : models.Note.encodeNoteId(note.id)
  history.updateHistory(userId, noteId, document, time)
  logger.info('history updated')
}

function newNote (req, res, next) {
  var owner = null
  var body = ''
  if (req.body && req.body.length > config.documentMaxLength) {
    return errorTooLong(req, res)
  } else if (req.body) {
    body = req.body
  }
  body = body.replace(/[\r]/g, '')
  if (req.isAuthenticated()) {
    owner = req.user.id
  } else if (!config.allowAnonymous) {
    return errorForbidden(req, res)
  }
  models.Note.create({
    ownerId: owner,
    alias: req.alias ? req.alias : null,
    content: body
  }).then(function (note) {
    if (req.isAuthenticated()) {
      updateHistory(owner, note, body)
    }

    return res.redirect(config.serverURL + '/' + models.Note.encodeNoteId(note.id))
  }).catch(function (err) {
    logger.error(err)
    return errorInternalError(req, res)
  })
}

async function newGitLabNote (req, res, next) {
  var gitlabid = req.params.gitlabid
  if (!req.body) {
    req.body = await retrieveGitLabFileContentByGitLabUrl(req, res, gitlabid)
  }
  req.alias = base64url.encode(gitlabid)
  newNote(req, res, next)
}

async function retrieveGitLabFileContentByGitLabUrl(req, res, gitlaburl) {
  const matchUrl = gitlaburl.match(/^(https?):\/\/([-a-zA-Z0-9@:%._\+~#=]+\.[a-zA-Z0-9()]{1,6})\/(.+)\/-\/blob\/([^/]+)\/(.*)$/)
  if (!matchUrl) {
    logger.info("invalid GitLab URL: " + gitlaburl)
    return errorBadRequest(req, res)
  }
  const scheme = matchUrl[1]
  const host = matchUrl[2]
  const projectPath = matchUrl[3]
  const branch = matchUrl[4]
  const filePath = matchUrl[5]
  if (req.isAuthenticated()) {
    const user = await models.User.findOne({
      where: {
        id: req.user.id
      }
    })
    if (!user) { return errorNotFound(req, res) }
    const file = await retrieveGitLabFile(projectPath, branch, filePath, user.accessToken)
    return base64url.decode(base64url.fromBase64(file.content))
  } else {
    return errorForbidden(req, res)
  }
}
async function executeGitLabApiRequest(apiRequest) {
  return new Promise((resolve, reject) => {
    try {
      request(
        config.gitlab.baseURL + '/api/' + config.gitlab.version + apiRequest,
        function (error, httpResponse, body) {
          if (!error && httpResponse.statusCode === 200) {
            return resolve(JSON.parse(body))
          } else {
            return reject(error)
          }
        }
      )
    }
    catch(err) {
      return reject(err)
    }
  })
}
async function retrieveGitLabProjectInfo(projectPath, accessToken) {
  return executeGitLabApiRequest('/projects/' + encodeURIComponent(projectPath) + '?access_token=' + accessToken)
}
async function retrieveGitLabFile(projectId, branch, filePath, accessToken) {
  return executeGitLabApiRequest('/projects/' + encodeURIComponent(projectId) + '/repository/files/' + encodeURIComponent(filePath) + '?ref=' + branch + '&access_token=' + accessToken)
}
async function retrieveGitLabProjectMember(projectPath, userId, accessToken) {
  return executeGitLabApiRequest('/projects/' + encodeURIComponent(projectPath) + '/members/all/' + userId + '?access_token=' + accessToken)
}
async function retrieveGitLabBranchInfo(projectPath, branch, accessToken) {
  return executeGitLabApiRequest('/projects/' + encodeURIComponent(projectPath) + '/repository/branches/' + branch + '?access_token=' + accessToken)
}

function newCheckViewPermission (note, isLogin, userId) {
  if (note.permission === 'private') {
    return note.ownerId === userId
  }
  if (note.permission === 'limited' || note.permission === 'protected') {
    return isLogin
  }
  return true
}

function checkViewPermission (req, note) {
  if (note.permission === 'private') {
    if (!req.isAuthenticated() || note.ownerId !== req.user.id) { return false } else { return true }
  } else if (note.permission === 'limited' || note.permission === 'protected') {
    if (!req.isAuthenticated()) { return false } else { return true }
  } else {
    return true
  }
}

function findNote (req, res, callback, include) {
  var noteId = req.params.noteId
  var id = req.params.noteId || req.params.shortid
  models.Note.parseNoteId(id, function (err, _id) {
    if (err) {
      logger.error(err)
      return errorInternalError(req, res)
    }
    models.Note.findOne({
      where: {
        id: _id
      },
      include: include || null
    }).then(function (note) {
      if (!note) {
        if (config.allowFreeURL && noteId && !config.forbiddenNoteIDs.includes(noteId)) {
          req.alias = noteId
          return newNote(req, res)
        } else {
          return errorNotFound(req, res)
        }
      }
      if (!checkViewPermission(req, note)) {
        return errorForbidden(req, res)
      } else {
        return callback(note)
      }
    }).catch(function (err) {
      logger.error(err)
      return errorInternalError(req, res)
    })
  })
}

function actionDownload (req, res, note) {
  var body = note.content
  var title = models.Note.decodeTitle(note.title)
  var filename = title
  filename = encodeURIComponent(filename)
  res.set({
    'Access-Control-Allow-Origin': '*', // allow CORS as API
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Cache-Control, Content-Encoding, Content-Range',
    'Content-Type': 'text/markdown; charset=UTF-8',
    'Cache-Control': 'private',
    'Content-disposition': 'attachment; filename=' + filename + '.md',
    'X-Robots-Tag': 'noindex, nofollow' // prevent crawling
  })
  res.send(body)
}

function publishNoteActions (req, res, next) {
  findNote(req, res, function (note) {
    var action = req.params.action
    switch (action) {
      case 'download':
        actionDownload(req, res, note)
        break
      case 'edit':
        res.redirect(config.serverURL + '/' + (note.alias ? note.alias : models.Note.encodeNoteId(note.id)))
        break
      default:
        res.redirect(config.serverURL + '/s/' + note.shortid)
        break
    }
  })
}

function publishSlideActions (req, res, next) {
  findNote(req, res, function (note) {
    var action = req.params.action
    switch (action) {
      case 'edit':
        res.redirect(config.serverURL + '/' + (note.alias ? note.alias : models.Note.encodeNoteId(note.id)))
        break
      default:
        res.redirect(config.serverURL + '/p/' + note.shortid)
        break
    }
  })
}

function githubActions (req, res, next) {
  var noteId = req.params.noteId
  findNote(req, res, function (note) {
    var action = req.params.action
    switch (action) {
      case 'gist':
        githubActionGist(req, res, note)
        break
      default:
        res.redirect(config.serverURL + '/' + noteId)
        break
    }
  })
}

function githubActionGist (req, res, note) {
  var code = req.query.code
  var state = req.query.state
  if (!code || !state) {
    return errorForbidden(req, res)
  } else {
    var data = {
      client_id: config.github.clientID,
      client_secret: config.github.clientSecret,
      code: code,
      state: state
    }
    var authUrl = 'https://github.com/login/oauth/access_token'
    request({
      url: authUrl,
      method: 'POST',
      json: data
    }, function (error, httpResponse, body) {
      if (!error && httpResponse.statusCode === 200) {
        var accessToken = body.access_token
        if (accessToken) {
          var content = note.content
          var title = models.Note.decodeTitle(note.title)
          var filename = title.replace('/', ' ') + '.md'
          var gist = {
            files: {}
          }
          gist.files[filename] = {
            content: content
          }
          var gistUrl = 'https://api.github.com/gists'
          request({
            url: gistUrl,
            headers: {
              'User-Agent': 'CodiMD',
              Authorization: 'token ' + accessToken
            },
            method: 'POST',
            json: gist
          }, function (error, httpResponse, body) {
            if (!error && httpResponse.statusCode === 201) {
              res.setHeader('referer', '')
              res.redirect(body.html_url)
            } else {
              return errorForbidden(req, res)
            }
          })
        } else {
          return errorForbidden(req, res)
        }
      } else {
        return errorForbidden(req, res)
      }
    })
  }
}

function gitlabActions (req, res, next) {
  var noteId = req.params.noteId
  findNote(req, res, function (note) {
    var action = req.params.action
    switch (action) {
      case 'projects':
        gitlabActionProjects(req, res, note)
        break
      case 'permission':
        gitlabActionPermission(req, res, noteId)
        break
      default:
        res.redirect(config.serverURL + '/' + noteId)
        break
    }
  })
}

function gitlabActionProjects (req, res, note) {
  if (req.isAuthenticated()) {
    models.User.findOne({
      where: {
        id: req.user.id
      }
    }).then(function (user) {
      if (!user) { return errorNotFound(req, res) }
      var ret = { baseURL: config.gitlab.baseURL, version: config.gitlab.version }
      ret.accesstoken = user.accessToken
      ret.profileid = user.profileid
      request(
        config.gitlab.baseURL + '/api/' + config.gitlab.version + '/projects?membership=yes&per_page=100&access_token=' + user.accessToken,
        function (error, httpResponse, body) {
          if (!error && httpResponse.statusCode === 200) {
            ret.projects = JSON.parse(body)
            return res.send(ret)
          } else {
            return res.send(ret)
          }
        }
      )
    }).catch(function (err) {
      logger.error('gitlab action projects failed: ' + err)
      return errorInternalError(req, res)
    })
  } else {
    return errorForbidden(req, res)
  }
}
function matchGitLabUrl(noteId) {
  const gitlabUrl = base64url.decode(noteId)
  return gitlabUrl.match(/^(https?):\/\/([-a-zA-Z0-9@:%._\+~#=]+\.[a-zA-Z0-9()]{1,6})\/(.+)\/-\/blob\/([^/]+)\/(.*)$/)
}
async function gitlabActionPermission(req, res, noteId) {
  if (req.isAuthenticated()) {
    const user = await models.User.findOne({
      where: {
        id: req.user.id
      }
    })
    if (!user) { return errorNotFound(req, res) }
    const matchUrl = matchGitLabUrl(noteId)
    if (!matchUrl) { return errorInternalError(req, res) }
    const projectPath = matchUrl[3]
    const branch = matchUrl[4]

    const ret = { baseURL: config.gitlab.baseURL, version: config.gitlab.version }
    ret.accesstoken = user.accessToken
    ret.profileid = user.profileid

    await retrieveGitLabProjectMember(projectPath, user.profileid, user.accessToken)
      .then(memberInfo => {
        ret.user_access_level = memberInfo["access_level"]
      })
      .catch(err => {
        ret.user_access_level = 0
      })

    await retrieveGitLabBranchInfo(projectPath, branch, user.accessToken)
      .then(branchInfo => {
        ret.can_push = branchInfo["can_push"]
      })
      .catch(err => {
        ret.can_push = false
      })

    return res.send(ret)
  } else {
    return errorForbidden(req, res)
  }
}

function showPublishSlide (req, res, next) {
  var include = [{
    model: models.User,
    as: 'owner'
  }, {
    model: models.User,
    as: 'lastchangeuser'
  }]
  findNote(req, res, function (note) {
    // force to use short id
    var shortid = req.params.shortid
    if ((note.alias && shortid !== note.alias) || (!note.alias && shortid !== note.shortid)) { return res.redirect(config.serverURL + '/p/' + (note.alias || note.shortid)) }
    note.increment('viewcount').then(function (note) {
      if (!note) {
        return errorNotFound(req, res)
      }
      var body = note.content
      var extracted = models.Note.extractMeta(body)
      var markdown = extracted.markdown
      var meta = models.Note.parseMeta(extracted.meta)
      var createtime = note.createdAt
      var updatetime = note.lastchangeAt
      var title = models.Note.decodeTitle(note.title)
      title = models.Note.generateWebTitle(meta.title || title)
      var data = {
        title: title,
        description: meta.description || (markdown ? models.Note.generateDescription(markdown) : null),
        viewcount: note.viewcount,
        createtime: createtime,
        updatetime: updatetime,
        body: markdown,
        theme: meta.slideOptions && utils.isRevealTheme(meta.slideOptions.theme),
        meta: JSON.stringify(extracted.meta),
        owner: note.owner ? note.owner.id : null,
        ownerprofile: note.owner ? models.User.getProfile(note.owner) : null,
        lastchangeuser: note.lastchangeuser ? note.lastchangeuser.id : null,
        lastchangeuserprofile: note.lastchangeuser ? models.User.getProfile(note.lastchangeuser) : null,
        robots: meta.robots || false, // default allow robots
        GA: meta.GA,
        disqus: meta.disqus,
        cspNonce: res.locals.nonce
      }
      res.set({
        'Cache-Control': 'private' // only cache by client
      })
      res.render('slide.ejs', data)
    }).catch(function (err) {
      logger.error(err)
      return errorInternalError(req, res)
    })
  }, include)
}
