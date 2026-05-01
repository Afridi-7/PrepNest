# PrepNest load tests

Locust-based scenarios that emulate realistic study traffic. Five user
classes run concurrently with weights tuned so the mix roughly matches
production:

| Class                  | Weight | What it does                                |
| ---------------------- | ------ | ------------------------------------------- |
| `BrowsingUser`         | 500    | Landing, health, dashboard reads            |
| `MCQUser`              | 100    | Lists USAT MCQs                             |
| `AITutorStreamUser`    | 50     | Opens chat SSE stream, reads N tokens       |
| `UploadUser`           | 20     | Uploads file, polls `/files/{id}/status`    |
| `MockTestUser`         | 100    | Lists mock tests                            |

## Install

```powershell
pip install "locust>=2.27"
```

## Run (headless, 5 min, 770 virtual users)

```powershell
$env:LOCUST_TOKEN = "<paste a JWT here>"
locust -f load_tests/locustfile.py `
       --host http://localhost:8000 `
       --headless --users 770 --spawn-rate 20 --run-time 5m
```

Drop `LOCUST_TOKEN` to run only the unauthenticated scenarios.

## Web UI

```powershell
locust -f load_tests/locustfile.py --host http://localhost:8000
# then open http://localhost:8089
```

## Targeting staging

```powershell
$env:LOCUST_TOKEN = "<staging JWT>"
locust -f load_tests/locustfile.py --host https://staging.prepnest.example.com
```

## Notes

* `LOCUST_API_PREFIX` overrides the default `/api/v1` prefix.
* `AITutorStreamUser` consumes a bounded number of SSE lines so a single
  long answer cannot stall a virtual user.
* Adjust the weights at the top of each class to model different
  traffic mixes (e.g. exam-day spike: bump `MCQUser` and `MockTestUser`).
