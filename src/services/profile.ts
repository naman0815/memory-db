const NAME_KEY = 'user-name'

export function getUserName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function setUserName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim())
}
