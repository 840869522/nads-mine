<?php

    namespace App\Exceptions;

    use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
    use Throwable;
    use Illuminate\Auth\AuthenticationException;
    use Illuminate\Validation\ValidationException;
    use Illuminate\Database\Eloquent\ModelNotFoundException;
    use Symfony\Component\HttpKernel\Exception\HttpException;
    use Illuminate\Support\Facades\Log;
    use App\Utils\GlobalResponse;

    class Handler extends ExceptionHandler{
        /**
         * A list of the exception types that are not reported.
         *
         * @var array<int, class-string<Throwable>>
         */
        protected $dontReport = [
            \Illuminate\Auth\AuthenticationException::class,
            \Illuminate\Validation\ValidationException::class,
            \Illuminate\Database\Eloquent\ModelNotFoundException::class,
            \Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class,
        ];

        /**
         * A list of the inputs that are never flashed for validation exceptions.
         *
         * @var array<int, string>
         */
        protected $dontFlash = [
            'current_password',
            'password',
            'password_confirmation',
        ];

        /**
         * Register the exception handling callbacks for the application.
         *
         * @return void
         */
        public function register(){
            $this->renderable(function (Throwable $e) {
                return $this->handleException( $e);
            });
        }


        public function handleException(Throwable $e){
            Log::debug('Exception caught: ' . get_class($e));
            // Handle AuthenticationException
            if ($e instanceof AuthenticationException) {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_NOT_AUTH_CODE,
                    'message' => GlobalResponse::HTTP_STATUS_ERROR_MES,
                ], 200);
            }

            // Handle ValidationException
            if ($e instanceof ValidationException) {
                return response()->json([
                    "code" => GlobalResponse::$HTTP_REQUEST_ERROR_MES,
                    'message' => GlobalResponse::HTTP_STATUS_ERROR_MES,
                ], 200);
            }

            // Handle ModelNotFoundException
            if ($e instanceof ModelNotFoundException) {
                return response()->json([
                    "code" => GlobalResponse::$DATABASE_ERROR_CODE,
                    'message' => 'The requested resource was not found on the server.',
                ], 200);
            }

            // Handle HttpException (e.g., 403, 404, etc.)
            if ($e instanceof HttpException ) {
                return response()->json([
                    "code"=> GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                    'message' => $e->getMessage() ?: 'HTTP Error',
                ], 200);
            }
            
            return response()->json([
                'code' => GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                'message' => "something happend error",
            ], 200);
        }
    }
?>
