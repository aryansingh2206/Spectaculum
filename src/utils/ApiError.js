class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = ""

  ) {super(message) // Call the parent constructor with the message
    this.statusCode = statusCode;
    this.data = null
    this.message = message;
    this.success = false;
    this.error = errors

    if(stack){
        this .stack = stack;
    }else{
        Error.captureStackTrace(this, this.constructor);    
    }
  }
}

export { ApiError };
