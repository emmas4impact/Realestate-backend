const badRequestHandler = (err,req,res,next) =>{
    if (err.httpStatusCode===400){
        res.status(400).send(err.message)
    }
    next(err)
}
const forbiddenHandler = (err, req, res, next) => {
    if (err.httpStatusCode === 403) {
      res.status(403).send(err.message || "Forbidden!")
    }
    next(err)
  } // 403
const notFoundHandler = (err,req,res,next) => {
    if(err.httpStatusCode=== 404){
        res.status(404).send(err.message || "Resource not found!")
    }
        next(err)

}

// catch all
const genericErrorHandler = (err,req,res,next)=>{
    if (!res.headersSent){
        res.status(err.httpStatusCode || 500).send(err.message)
    }
}
export default {
    badRequestHandler,
    notFoundHandler,
    forbiddenHandler,
    genericErrorHandler
}