import os
from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import make_url

from models import Base

# Getting the Database URL
load_dotenv()
database_url = os.getenv('DATABASE_URL')

if not database_url:
    # raise RuntimeError("DATABASE_URL not set. Please configure it in your '.env'")
    database_url = 'sqlite:///./pausepal.db'


# Identifying database type and respectively configuring connection argument
url = make_url(database_url)
connect_args = {}

if url.get_backend_name() == "sqlite":
    connect_args={"check_same_thread": False}


    
# Creating an Engine
engine = create_engine(
    database_url, 
    echo=True, 
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autoflush=False,
    bind=engine,
)


# Creating the Database
Base.metadata.create_all(bind=engine)