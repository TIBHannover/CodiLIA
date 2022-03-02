import base64url from "base64url";

function matchGitLabUrl(noteId) {
  const gitlabUrl = base64url.decode(noteId)
  return gitlabUrl.match(/^(https?):\/\/([-a-zA-Z0-9@:%._\+~#=]+\.[a-zA-Z0-9()]{1,6})\/(.+)\/-\/blob\/([^/]+)\/(.*)$/)
}

export function isGitLabNote(noteId) {
  const matchUrl = matchGitLabUrl(noteId)
  return !!matchUrl;
}

export async function updateGitLabFile(baseURL, apiVersion, accessToken, noteId, content) {
  const gitlabUrl = base64url.decode(noteId)
  const matchUrl = matchGitLabUrl(noteId)
  if (!matchUrl) {
    console.warn("invalid GitLab URL: " + gitlabUrl)
    return {
      status: "Unsuccessful"
    }
  }
  const projectPath = matchUrl[3]
  const branch = matchUrl[4]
  const filePath = matchUrl[5]
  const fileUploadBody = {
    branch: branch,
    content: content,
    commit_message: "Updated " + filePath
  }
  if (!fileUploadBody.commit_message || !filePath || !fileUploadBody.content || !projectPath) return
  const fullURL = baseURL + '/api/' + apiVersion + '/projects/' + encodeURIComponent(projectPath) + '/repository/files/' + encodeURIComponent(filePath) + '?access_token=' + accessToken

  const response = await fetch(fullURL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fileUploadBody)
  })
  if (response.status === 200) {
    const json = await response.json()
    return {
      status: "Successful",
      projectPath: projectPath,
      filePath: json.file_path,
      branch: json.branch
    }
  } else {
    return {
      status: "Unsuccessful"
    }
  }
}
