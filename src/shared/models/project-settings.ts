export interface IProjectSettings {
  repo?: string,
  issue?: IIssue,
  currentWork?: string,
  repositories: IRepository[] | undefined
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