import argparse
import uuid

import jwt


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a demo JWT for local development.")
    parser.add_argument("--user-id", default=str(uuid.uuid4()))
    parser.add_argument("--email", required=True)
    parser.add_argument("--role", choices=["customer", "restaurant", "delivery_partner"], required=True)
    parser.add_argument("--secret", default="dev-secret-change-me-please-keep-long")
    parser.add_argument("--algorithm", default="HS256")
    args = parser.parse_args()

    token = jwt.encode(
        {
            "sub": args.user_id,
            "email": args.email,
            "role": args.role,
        },
        args.secret,
        algorithm=args.algorithm,
    )
    print(token)


if __name__ == "__main__":
    main()
