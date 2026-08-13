import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app


async def main() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo-dental.com", "password": "Admin@123"},
        )
        login.raise_for_status()
        token = login.json()["accessToken"]
        patients = await client.get("/api/patients", headers={"Authorization": f"Bearer {token}"})
        patients.raise_for_status()
        print(
            {
                "login": login.status_code,
                "patients": patients.status_code,
                "total": patients.json()["pagination"]["total"],
            }
        )


if __name__ == "__main__":
    asyncio.run(main())
