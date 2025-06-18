<?php

    namespace App\Exceptions;

    use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
    use Throwable;
    use Illuminate\Auth\AuthenticationException;
    use Illuminate\Validation\ValidationException;
    use Illuminate\Database\Eloquent\ModelNotFoundException;
    use Symfony\Component\HttpKernel\Exception\HttpException;

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
        public function register()
        {
            $this->reportable(function (Throwable $e, $request) {
                return $this->handleException($request, $e);
            });
        }


        public function handleException($request, Throwable $e){
            // Handle AuthenticationException
            if ($e instanceof AuthenticationException) {
                return response()->json([
                    "code" => 401,
                    'error' => 'Unauthenticated',
                    'message' => 'You need to be authenticated to access this resource.',
                ], 200);
            }

            // Handle ValidationException
            if ($e instanceof ValidationException) {
                return response()->json([
                    "code" => 422,
                    'error' => 'Validation Failed',
                    'message' => $e->errors(),
                ], 200);
            }

            // Handle ModelNotFoundException
            if ($e instanceof ModelNotFoundException) {
                return response()->json([
                    "code" => 404,
                    'error' => 'Resource Not Found',
                    'message' => 'The requested resource was not found on the server.',
                ], 200);
            }

            // Handle HttpException (e.g., 403, 404, etc.)
            if ($e instanceof HttpException) {
                return response()->json([
                    'error' => $e->getMessage() ?: 'HTTP Error',
                    'message' => 'An HTTP error occurred.',
                ], $e->getStatusCode());
            }
            
            return response()->json([
                'code' => 400,
                'message' => "somerthing happend error",
            ], 200);
        }
    }
?>
