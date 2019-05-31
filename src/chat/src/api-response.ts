
export class APIResponse {
  constructor(public code: number,
              public message: string,
              public response: object,
              public status: string)
  {}
}
