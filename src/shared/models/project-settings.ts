export interface IProjectSettings {
  repo?: string,
  issue?: IIssue,
  currentWork?: string,
  repositories?: IRepository[]
}

export interface IRepository {
  name: string,
  issues: IIssue[]
}

export interface IIssue {
  number: number,
  id: number,
  title: string
}